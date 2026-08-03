import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

async function git(args, cwd) {
  return run('git', args, { cwd, encoding: 'utf8' });
}

export async function shouldSkip(config) {
  const cwd = process.cwd();
  const { stdout: root } = await git(['rev-parse', '--show-toplevel'], cwd);
  const repo = root.trim();
  const relative = config.startsWith(`${repo}/`) ? config.slice(repo.length + 1) : config;
  const { stdout: status } = await git(['status', '--porcelain', '--', relative], repo);
  if (status.trim()) return false;
  const { stdout: subject } = await git(['log', '-1', '--format=%s'], repo);
  return subject.trim().startsWith('Pushback ');
}

export async function pushBack(config) {
  const { stdout: root } = await git(['rev-parse', '--show-toplevel'], process.cwd());
  const repo = root.trim();
  const relative = config.startsWith(`${repo}/`) ? config.slice(repo.length + 1) : config;
  const { stdout: diff } = await git(['diff', '--', relative], repo);
  if (!diff) return false;
  await git(['add', '--', relative], repo);
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  await git(['commit', '-m', `Pushback ${timestamp}`], repo);
  await git(['push'], repo);
  return true;
}
