import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const run = promisify(execFile);
const entrypoint = join(process.cwd(), 'vyops.mjs');

test('prints help and version without external effects', async () => {
  const help = await run(process.execPath, [entrypoint, '--help']);
  expect(help.stdout).toMatch(/Usage:/);

  const version = await run(process.execPath, [entrypoint, '--version']);
  expect(version.stdout.trim()).toBe('1.0.0');
});

test('dry-run validates config without connecting or pushing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vyops-test-'));
  const config = join(directory, 'config.boot');
  await writeFile(config, 'system {\n    host-name test\n}\n');
  try {
    const result = await run(process.execPath, [entrypoint, '--dry-run', 'vyos@core1', config]);
    expect(result.stdout).toContain('Configuration valid; dry run for vyos@core1');
    expect(result.stderr).toBe('');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
