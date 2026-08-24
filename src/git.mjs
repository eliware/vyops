import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { path } from '@eliware/common';

const run = promisify(execFile);
const LOCK_MAX_AGE = 60 * 60 * 1000;

async function git(args, cwd) {
  return run('git', args, { cwd, encoding: 'utf8' });
}

async function staleLock(lock) {
  let owner;
  let stats;
  try {
    [owner, stats] = await Promise.all([
      fs.readFile(path(lock, 'owner'), 'utf8'),
      fs.stat(lock),
    ]);
  } catch {
    return false;
  }
  const pid = Number.parseInt(owner.trim(), 10);
  if (Number.isInteger(pid) && pid > 0) {
    try {
      process.kill(pid, 0);
      return false;
    } catch (error) {
      if (error.code === 'EPERM') return false;
      if (error.code === 'ESRCH') return true;
      return false;
    }
  }
  return Date.now() - stats.mtimeMs > LOCK_MAX_AGE;
}

async function withRepositoryLock(repo, action, force) {
  const lock = path(repo, '.git', 'vyops-pushback.lock');
  try {
    await fs.mkdir(lock);
  } catch (error) {
    if (error.code !== 'EEXIST' || (!force && !(await staleLock(lock)))) {
      if (error.code === 'EEXIST') throw new Error('another pushback is already running');
      throw error;
    }
    await fs.rm(lock, { recursive: true, force: true });
    await fs.mkdir(lock);
  }
  try {
    await fs.writeFile(path(lock, 'owner'), `${process.pid}\n`, 'utf8');
    return await action();
  } finally {
    await fs.rm(lock, { recursive: true, force: true });
  }
}

function configDirectory(config) {
  return path(config, '..');
}

function relativeConfigPath(repo, config) {
  return relative(repo, resolve(config));
}

async function repositoryRoot(config) {
  try {
    const { stdout } = await git(['rev-parse', '--show-toplevel'], configDirectory(config));
    return stdout.trim();
  } catch (error) {
    if (error.stderr?.includes('not a git repository')) return null;
    throw error;
  }
}

export async function shouldSkip(config) {
  const repo = await repositoryRoot(config);
  if (!repo) return false;
  const relativePath = relativeConfigPath(repo, config);
  const { stdout: status } = await git(['status', '--porcelain', '--', relativePath], repo);
  if (status.trim()) return false;
  const { stdout: subject } = await git(['log', '-1', '--format=%s'], repo);
  return subject.trim().startsWith('Pushback ');
}

export async function pushBack(config, { force = false } = {}) {
  const repo = await repositoryRoot(config);
  if (!repo) return false;
  return withRepositoryLock(repo, async () => {
    const relativePath = relativeConfigPath(repo, config);
    const { stdout: diff } = await git(['diff', 'HEAD', '--', relativePath], repo);
    if (!diff) return false;
    await git(['add', '--', relativePath], repo);
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await git(['commit', '--only', '-m', `Pushback ${timestamp}`, '--', relativePath], repo);
    await git(['push'], repo);
    return true;
  }, force);
}
