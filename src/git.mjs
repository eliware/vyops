import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { path } from '@eliware/common';
import { pushFailure } from './git/push-failure.mjs';

const run = promisify(execFile);
const LOCK_MAX_AGE = 60 * 60 * 1000;

async function git(args, cwd) {
  return run('git', args, { cwd, encoding: 'utf8' });
}

async function repositoryState(repo) {
  const [head, branch, upstream, status] = await Promise.all([
    git(['rev-parse', 'HEAD'], repo),
    // codescope ignore: next detached HEAD is covered by integration repositories.
    git(['symbolic-ref', '--quiet', '--short', 'HEAD'], repo).catch(() => ({ stdout: 'DETACHED' })),
    git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], repo).catch(() => ({ stdout: '(none)' })),
    git(['status', '--porcelain=v1'], repo),
  ]);
  return `${head.stdout.trim()}\n${branch.stdout.trim()}\n${upstream.stdout.trim()}\n${status.stdout}`;
}

// codescope ignore: next repository snapshot is exercised by the CLI integration path.
export async function repositorySnapshot(config) {
  const repo = await repositoryRoot(config);
  return repo ? { repo, state: await repositoryState(repo) } : null;
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

async function relativeConfigPath(repo, config) {
  // realpath plus the containment check below keeps Git pathspecs inside repo.
  const [canonicalRepo, canonicalConfig] = await Promise.all([
    fs.realpath(repo),
    fs.realpath(resolve(config)),
  ]);
  const relativePath = relative(canonicalRepo, canonicalConfig);
  if (!relativePath || relativePath === '..' || relativePath.startsWith(`..${path.sep}`)) {
    throw new Error('configuration path is outside the Git repository');
  }
  return relativePath;
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
  const relativePath = await relativeConfigPath(repo, config);
  const { stdout: status } = await git(['status', '--porcelain', '--', relativePath], repo);
  if (status.trim()) return false;
  const { stdout: subject } = await git(['log', '-1', '--format=%s'], repo);
  return subject.trim().startsWith('Pushback ');
}

export async function pushBack(config, { force = false, expectedState, beforeCommit = async () => {} } = {}) {
  const repo = await repositoryRoot(config);
  if (!repo) return false;
  return withRepositoryLock(repo, async () => {
    const initialState = await repositoryState(repo);
    if (expectedState && (expectedState.repo !== repo || initialState !== expectedState.state)) {
      throw new Error('repository changed during deployment; refusing to commit');
    }
    const relativePath = await relativeConfigPath(repo, config);
    const { stdout: diff } = await git(['diff', 'HEAD', '--', relativePath], repo);
    if (!diff) return false;
    await beforeCommit(repo);
    if (await repositoryState(repo) !== initialState) throw new Error('repository changed during pushback; refusing to commit');
    await git(['add', '--', relativePath], repo);
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await git(['commit', '--only', '-m', `Pushback ${timestamp}`, '--', relativePath], repo);
    try {
      await git(['push'], repo);
    } catch (error) {
      throw await pushFailure(git, repo, error);
    }
    return true;
  }, force);
}
