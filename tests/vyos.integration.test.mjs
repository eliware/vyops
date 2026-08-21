import { jest } from '@jest/globals';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const run = promisify(execFile);
const target = process.env.VYOPS_VYOS_TARGET;
const config = process.env.VYOPS_VYOS_CONFIG;
const enabled = Boolean(target && config && existsSync(config) && process.env.VYOPS_RUN_INTEGRATION === '1');
const suite = enabled ? describe : describe.skip;
const mutations = enabled && process.env.VYOPS_RUN_MUTATING_INTEGRATION === '1' ? test : test.skip;

suite('real VyOS integration', () => {
  jest.setTimeout(300_000);

  test('dry-run validates the test configuration', async () => {
    const result = await run(process.execPath, [join(process.cwd(), 'vyops.mjs'), '--dry-run', target, config]);
    expect(result.stdout).toContain(`Configuration valid; dry run for ${target}`);
  });

  test('backup mode completes against the disposable router', async () => {
    const destination = process.env.VYOPS_VYOS_BACKUP_DIR ?? mkdtempSync(join(tmpdir(), 'vyops-integration-backup-'));
    const result = await run(process.execPath, [join(process.cwd(), 'vyops.mjs'), '--backup', target, destination]);
    expect(result.stdout).toContain('Backup successful');
  });

  mutations('deploys a valid change and synchronizes scripts', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'vyops-integration-valid-'));
    const variant = join(directory, 'config.boot');
    const source = readFileSync(config, 'utf8');
    writeFileSync(variant, source.replace('host-name "vyops-test"', 'host-name "vyops-test-valid"'));
    mkdirSync(join(directory, 'scripts'));
    writeFileSync(join(directory, 'scripts', 'vyops-integration-marker.sh'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const result = await run(process.execPath, [join(process.cwd(), 'vyops.mjs'), '--force', target, variant], { timeout: 180_000 });
    expect(result.stdout).toContain('Deployment successful');
  });

  mutations('rejects a semantically invalid configuration without hanging', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'vyops-integration-invalid-'));
    const variant = join(directory, 'config.boot');
    const source = readFileSync(config, 'utf8');
    writeFileSync(variant, source.replace('100.64.10.50/24', '100.64.10.50/99'));
    await expect(run(process.execPath, [join(process.cwd(), 'vyops.mjs'), '--force', target, variant], { timeout: 120_000 })).rejects.toMatchObject({ code: 1 });
  });
});
