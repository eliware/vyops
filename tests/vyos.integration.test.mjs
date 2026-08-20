import { jest } from '@jest/globals';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const run = promisify(execFile);
const target = process.env.VYOPS_VYOS_TARGET;
const config = process.env.VYOPS_VYOS_CONFIG;
const enabled = Boolean(target && config && existsSync(config) && process.env.VYOPS_RUN_INTEGRATION === '1');
const suite = enabled ? describe : describe.skip;

suite('real VyOS integration', () => {
  jest.setTimeout(120_000);

  test('dry-run validates the test configuration', async () => {
    const result = await run(process.execPath, [join(process.cwd(), 'vyops.mjs'), '--dry-run', target, config]);
    expect(result.stdout).toContain(`Configuration valid; dry run for ${target}`);
  });

  test('backup mode completes against the disposable router', async () => {
    const destination = process.env.VYOPS_VYOS_BACKUP_DIR;
    expect(destination).toBeTruthy();
    const result = await run(process.execPath, [join(process.cwd(), 'vyops.mjs'), '--backup', target, destination]);
    expect(result.stdout).toContain('Backup successful');
  });
});
