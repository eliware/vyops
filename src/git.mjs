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

async function repositoryState(repo, configPath) {
  const deploymentPaths = [configPath, `${configPath}.manifest.tsv`];
  const excludedPaths = deploymentPaths.map(value => `:(exclude,literal)${value}`);
  const [head, branch, upstream, status, stagedDeploymentPaths] = await Promise.all([
    git(['rev-parse', 'HEAD'], repo),
    // codescope ignore: next detached HEAD is covered by integration repositories.
    git(['symbolic-ref', '--quiet', '--short', 'HEAD'], repo).catch(() => ({ stdout: 'DETACHED' })),
    git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], repo).catch(() => ({ stdout: '(none)' })),
    git(['status', '--porcelain=v1', '--untracked-files=all', '--', '.', ...excludedPaths], repo),
    git(['diff', '--cached', '--name-status', '--no-renames', '--', ...deploymentPaths], repo),
  ]);
  return `${head.stdout.trim()}\n${branch.stdout.trim()}\n${upstream.stdout.trim()}\n${stagedDeploymentPaths.stdout}${status.stdout}`;
}

// codescope ignore: next repository snapshot is exercised by the CLI integration path.
export async function repositorySnapshot(config) {
  const repo = await repositoryRoot(config);
  if (!repo) return null;
  const configPath = await relativeConfigPath(repo, config);
  return { repo, state: await repositoryState(repo, configPath) };
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

async function pushbackPaths(repo, configPath) {
  const paths = [configPath];
  const manifestPath = `${configPath}.manifest.tsv`;
  const tracked = await git(['ls-files', '--error-unmatch', '--', manifestPath], repo).then(() => true, () => false);
  const present = await fs.access(resolve(repo, manifestPath)).then(() => true, () => false);
  if (tracked || present) paths.push(manifestPath);
  return paths;
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
  const relativePath = await relativeConfigPath(repo, config);
  const deploymentPaths = await pushbackPaths(repo, relativePath);
  return withRepositoryLock(repo, async () => {
    const initialState = await repositoryState(repo, relativePath);
    if (expectedState && (expectedState.repo !== repo || initialState !== expectedState.state)) {
      throw new Error('repository changed during deployment; refusing to commit');
    }
    const { stdout: diff } = await git(['diff', 'HEAD', '--', ...deploymentPaths], repo);
    if (!diff) return false;
    await beforeCommit(repo);
    if (await repositoryState(repo, relativePath) !== initialState) throw new Error('repository changed during pushback; refusing to commit');
    await git(['add', '--', ...deploymentPaths], repo);
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await git(['commit', '--only', '-m', `Pushback ${timestamp}`, '--', ...deploymentPaths], repo);
    try {
      await git(['push'], repo);
    } catch (error) {
      throw await pushFailure(git, repo, error);
    }
    return true;
  }, force);
}
