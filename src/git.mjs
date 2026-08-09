import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';
import { path } from '@eliware/common';

const run = promisify(execFile);

async function git(args, cwd) {
  return run('git', args, { cwd, encoding: 'utf8' });
}

async function withRepositoryLock(repo, action) {
  const lock = path(repo, '.git', 'vyops-pushback.lock');
  try {
    await fs.mkdir(lock);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('another pushback is already running');
    throw error;
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

export async function shouldSkip(config) {
  const cwd = configDirectory(config);
  const { stdout: root } = await git(['rev-parse', '--show-toplevel'], cwd);
  const repo = root.trim();
  const relative = config.startsWith(`${repo}/`) ? config.slice(repo.length + 1) : config;
  const { stdout: status } = await git(['status', '--porcelain', '--', relative], repo);
  if (status.trim()) return false;
  const { stdout: subject } = await git(['log', '-1', '--format=%s'], repo);
  return subject.trim().startsWith('Pushback ');
}

export async function pushBack(config) {
  const { stdout: root } = await git(['rev-parse', '--show-toplevel'], configDirectory(config));
  const repo = root.trim();
  return withRepositoryLock(repo, async () => {
    const relative = config.startsWith(`${repo}/`) ? config.slice(repo.length + 1) : config;
    const { stdout: diff } = await git(['diff', '--', relative], repo);
    if (!diff) return false;
    await git(['add', '--', relative], repo);
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await git(['commit', '--only', '-m', `Pushback ${timestamp}`, '--', relative], repo);
    await git(['push'], repo);
    return true;
  });
}
