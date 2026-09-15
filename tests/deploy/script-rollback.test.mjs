import { jest } from '@jest/globals';
import { finalizeScripts, rollbackScripts } from '../../src/deploy/script-rollback.mjs';

test('rolls back managed script paths and warns on failure', async () => {
  const exec = jest.fn().mockRejectedValue(new Error('transport lost'));
  const log = { warn: jest.fn() };
  await rollbackScripts(exec, log, { client: {}, manifest: '/tmp/m.tsv', installDir: '/config/scripts', backupDir: '/tmp/b', remoteDir: '/tmp/r' });
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('script rollback failed'));
});

test('removes staging only after committed deployment', async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0 });
  await finalizeScripts(exec, { warn: jest.fn() }, { client: {}, committed: true, backupDir: '/tmp/b', remoteDir: '/tmp/r' });
  expect(exec.mock.calls[0][1]).toContain('rm -rf');
});
