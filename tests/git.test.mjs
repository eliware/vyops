import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { jest } from '@jest/globals';
import { shouldSkip, pushBack } from '../src/git.mjs';

const run = promisify(execFile);

async function git(cwd, ...args) {
  await run('git', args, { cwd });
}


function lockPath(directory) {
  return join(directory, '.git', 'vyops-pushback.lock');
}

async function makeLock(directory, owner = 'not-a-pid', old = true) {
  const lock = lockPath(directory);
  await mkdir(lock);
  await writeFile(join(lock, 'owner'), `${owner}\n`);
  if (old) {
    const time = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await utimes(lock, time, time);
  }
  return lock;
}

async function repository() {
  const directory = await mkdtemp(join(tmpdir(), 'vyops-git-test-'));
  await git(directory, 'init');
  await git(directory, 'config', 'user.email', 'test@example.invalid');
  await git(directory, 'config', 'user.name', 'Test');
  const config = join(directory, 'config.boot');
  await writeFile(config, 'system {}\n');
  await git(directory, 'add', 'config.boot');
  await git(directory, 'commit', '-m', 'Initial');
  return { directory, config };
}

test('shouldSkip is false for changed config', async () => {
  const { directory, config } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await writeFile(config, 'system {\n    host-name changed\n}\n');
    await expect(shouldSkip(config)).resolves.toBe(false);
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test('Git integration is optional outside a repository', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vyops-no-git-'));
  const config = join(directory, 'config.boot');
  await writeFile(config, 'system {}\n');
  try {
    await expect(shouldSkip(config)).resolves.toBe(false);
    await expect(pushBack(config)).resolves.toBe(false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Git integration propagates unexpected repository errors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vyops-invalid-git-'));
  const parent = join(directory, 'not-a-directory');
  await writeFile(parent, 'not a directory\n');
  try {
    await expect(shouldSkip(join(parent, 'config.boot'))).rejects.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('shouldSkip recognizes an unchanged Pushback commit', async () => {
  const { directory, config } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await git(directory, 'commit', '--allow-empty', '-m', 'Pushback test');
    await expect(shouldSkip(config)).resolves.toBe(true);
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test('pushBack returns false when config has no diff', async () => {
  const { directory } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await expect(pushBack('config.boot')).resolves.toBe(false);
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test('shouldSkip accepts a repository-relative config path', async () => {
  const { directory } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await git(directory, 'commit', '--allow-empty', '-m', 'Pushback relative');
    await expect(shouldSkip('config.boot')).resolves.toBe(true);
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test('handles absolute config paths with normalized separators', async () => {
  const { directory, config } = await repository();
  const normalizedConfig = config.replaceAll('\\', '/');
  await expect(shouldSkip(normalizedConfig)).resolves.toBe(false);
  await expect(pushBack(normalizedConfig)).resolves.toBe(false);
  await rm(directory, { recursive: true, force: true });
});

test('pushBack commits and pushes a changed config', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vyops-remote-'));
  const remote = join(directory, 'remote.git');
  await git(directory, 'init', '--bare', remote);
  const repo = join(directory, 'repo');
  await git(directory, 'clone', remote, repo);
  await git(repo, 'config', 'user.email', 'test@example.invalid');
  await git(repo, 'config', 'user.name', 'Test');
  const config = join(repo, 'config.boot');
  await writeFile(config, 'system {\n    host-name initial\n}\n');
  await git(repo, 'add', 'config.boot');
  await git(repo, 'commit', '-m', 'Initial');
  await git(repo, 'push', '-u', 'origin', 'HEAD');
  await writeFile(config, 'system {\n    host-name changed\n}\n');
  const previous = process.cwd();
  process.chdir(repo);
  try {
    await expect(pushBack(config)).resolves.toBe(true);
    await expect(run('git', ['log', '-1', '--format=%s'], { cwd: repo })).resolves.toMatchObject({ stdout: expect.stringMatching(/^Pushback /) });
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test('pushBack includes staged config changes', async () => {
  const { directory, config } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await writeFile(config, 'system {\n    host-name staged\n}\n');
    await git(directory, 'add', 'config.boot');
    await expect(pushBack(config)).rejects.toThrow('No configured push destination');
    await expect(run('git', ['show', '--format=%s', '--stat', '--oneline', 'HEAD'], { cwd: directory }))
      .resolves.toMatchObject({ stdout: expect.stringContaining('Pushback ') });
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test('git checks use the config directory instead of the process cwd', async () => {
  const { directory, config } = await repository();
  const previous = process.cwd();
  const outside = await mkdtemp(join(tmpdir(), 'vyops-outside-'));
  process.chdir(outside);
  try {
    await git(directory, 'commit', '--allow-empty', '-m', 'Pushback config directory');
    await expect(shouldSkip(config)).resolves.toBe(true);
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});


test('rejects an active pushback lock', async () => {
  const { directory } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await makeLock(directory, String(process.pid), false);
    await expect(pushBack('config.boot')).rejects.toThrow('another pushback is already running');
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test('reclaims stale and malformed pushback locks', async () => {
  const { directory } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await makeLock(directory);
    await expect(pushBack('config.boot')).resolves.toBe(false);
    await makeLock(directory, '999999999', false);
    await expect(pushBack('config.boot', { force: true })).resolves.toBe(false);
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test.each([['EPERM', 'EPERM'], ['unexpected kill error', 'EINVAL']])('keeps a lock when process check returns %s', async (_label, code) => {
  const { directory } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  const kill = jest.spyOn(process, 'kill').mockImplementation(() => { throw Object.assign(new Error(code), { code }); });
  try {
    await makeLock(directory, '12345');
    await expect(pushBack('config.boot')).rejects.toThrow('another pushback is already running');
  } finally {
    kill.mockRestore();
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test('reclaims a lock owned by a dead process', async () => {
  const { directory } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  const kill = jest.spyOn(process, 'kill').mockImplementation(() => { throw Object.assign(new Error('dead'), { code: 'ESRCH' }); });
  try {
    await makeLock(directory, '12345', false);
    await expect(pushBack('config.boot')).resolves.toBe(false);
  } finally {
    kill.mockRestore();
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});


test('does not reclaim a lock with missing owner metadata', async () => {
  const { directory } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await mkdir(lockPath(directory));
    await expect(pushBack('config.boot')).rejects.toThrow('another pushback is already running');
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});

test('propagates lock creation errors other than contention', async () => {
  const { directory } = await repository();
  const previous = process.cwd();
  process.chdir(directory);
  const mkdirSpy = jest.spyOn(fs, 'mkdir').mockImplementation(async lock => {
    if (String(lock).endsWith('vyops-pushback.lock')) throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
    return undefined;
  });
  try {
    await expect(pushBack('config.boot')).rejects.toThrow('permission denied');
  } finally {
    mkdirSpy.mockRestore();
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});
