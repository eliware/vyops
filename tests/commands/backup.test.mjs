import { jest } from '@jest/globals';
const backup = jest.fn();
jest.unstable_mockModule('../../src/backup.mjs', () => ({ backup }));
const { runBackup } = await import('../../src/commands/backup.mjs');
test('runs backup and reports success', async () => {
  const log = { info: jest.fn() };
  const args = { config: '/tmp/config.boot' };
  await runBackup(args, log);
  expect(backup).toHaveBeenCalledWith(args);
  expect(log.info).toHaveBeenCalledWith('Backup successful: /tmp/config.boot');
});
