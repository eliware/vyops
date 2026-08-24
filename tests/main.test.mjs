import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import packageJson from '../package.json' with { type: 'json' };
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const run = promisify(execFile);
const entrypoint = join(process.cwd(), 'vyops.mjs');
const binEntrypoint = join(process.cwd(), 'bin', 'vyops');

test('prints help and version without external effects', async () => {
  const help = await run(process.execPath, [entrypoint, '--help']);
  expect(help.stdout).toMatch(/Usage:/);

  const version = await run(process.execPath, [entrypoint, '--version']);
  expect(version.stdout.trim()).toBe(`[INFO] ${packageJson.version}`);
});

test('packaged bin entrypoint invokes the CLI', async () => {
  const result = process.platform === 'win32'
    ? await run(process.execPath, [binEntrypoint, '--help'])
    : await run(binEntrypoint, ['--help']);
  expect(result.stdout).toMatch(/Usage:/);
});

test('dry-run validates config without connecting or pushing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vyops-test-'));
  const config = join(directory, 'config.boot');
  await writeFile(config, 'system {\n    host-name test\n}\n');
  try {
    const result = await run(process.execPath, [entrypoint, '--dry-run', 'testuser@test-router.example.test', config]);
    expect(result.stdout).toContain('Configuration valid; dry run for testuser@test-router.example.test');
    expect(result.stderr).toBe('');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('invalid config exits nonzero without attempting deployment', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vyops-test-'));
  const config = join(directory, 'config.boot');
  await writeFile(config, 'system {\n    host-name broken\n');
  try {
    await expect(run(process.execPath, [entrypoint, '--dry-run', 'testuser@test-router.example.test', config]))
      .rejects.toMatchObject({ code: 1, stdout: expect.stringContaining('unbalanced braces') });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('invalid invocation exits nonzero', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vyops-test-'));
  const config = join(directory, 'config.boot');
  await writeFile(config, 'system {\n    host-name test\n}\n');
  try {
    await expect(run(process.execPath, [entrypoint, '--dry-run', 'router', config, 'extra']))
      .rejects.toMatchObject({ code: 1, stdout: expect.stringContaining('Usage:') });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
