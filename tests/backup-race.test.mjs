import { jest } from '@jest/globals';
import { join } from 'node:path';

const fsMocks = { mkdir: jest.fn() };
const mocks = {
  connect: jest.fn().mockResolvedValue({}),
  close: jest.fn().mockResolvedValue(undefined),
  download: jest.fn().mockResolvedValue(undefined),
  exec: jest.fn(),
};
jest.unstable_mockModule('@eliware/common', () => ({
  fs: { promises: fsMocks }, path: (...parts) => join(...parts),
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.unstable_mockModule('../src/ssh.mjs', () => mocks);
const { backup } = await import('../src/backup.mjs');

test('rejects a script replaced before metadata validation', async () => {
  mocks.exec
    .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
    .mockResolvedValueOnce({ code: 0, stdout: '/config/scripts/hook.sh\0', stderr: '' })
    .mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'path changed' });
  await expect(backup({ target: 'vyos@router', config: '/tmp/backup' }))
    .rejects.toThrow('remote script changed or is not a regular file: /config/scripts/hook.sh');
  expect(mocks.download).toHaveBeenCalledTimes(1);
  expect(mocks.close).toHaveBeenCalled();
});
