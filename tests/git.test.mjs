import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { shouldSkip, pushBack } from '../src/git.mjs';

const run = promisify(execFile);

async function git(cwd, ...args) {
  await run('git', args, { cwd });
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
