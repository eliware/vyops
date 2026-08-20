import { jest } from '@jest/globals';
import { join } from 'node:path';

const fsMocks = { mkdir: jest.fn() };
const mocks = {
  connect: jest.fn(), close: jest.fn().mockResolvedValue(undefined),
  download: jest.fn().mockResolvedValue(undefined), exec: jest.fn(),
};
jest.unstable_mockModule('@eliware/common', () => ({
  fs: { promises: fsMocks }, path: (...parts) => join(...parts),
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.unstable_mockModule('../src/ssh.mjs', () => mocks);
const { backup } = await import('../src/backup.mjs');

beforeEach(() => {
  jest.clearAllMocks();
  mocks.connect.mockResolvedValue({});
  mocks.exec.mockResolvedValue({ code: 0, stdout: '/config/scripts/foo.sh\n/config/scripts/nested/bar\n', stderr: '' });
});

test('backs up config and nested scripts', async () => {
  await expect(backup({ target: 'vyos@router', config: '/tmp/backup' })).resolves.toBe(0);
  expect(mocks.download).toHaveBeenNthCalledWith(1, expect.anything(), '/config/config.boot', '/tmp/backup/config.boot');
  expect(mocks.download).toHaveBeenNthCalledWith(2, expect.anything(), '/config/scripts/foo.sh', '/tmp/backup/scripts/foo.sh');
  expect(mocks.download).toHaveBeenNthCalledWith(3, expect.anything(), '/config/scripts/nested/bar', '/tmp/backup/scripts/nested/bar');
  expect(mocks.close).toHaveBeenCalled();
});

test('passes a bootstrap password through to SSH', async () => {
  await expect(backup({ target: 'vyos@router', config: '/tmp/backup', password: 'bootstrap-secret' })).resolves.toBe(0);
  expect(mocks.connect).toHaveBeenCalledWith('vyos@router', { password: 'bootstrap-secret' });
});

test('rejects unsafe remote script paths and closes SSH', async () => {
  mocks.exec.mockResolvedValue({ code: 0, stdout: '/config/scripts/../private\n', stderr: '' });
  await expect(backup({ target: 'vyos@router', config: '/tmp/backup' })).rejects.toThrow('unsafe remote script path');
  expect(mocks.close).toHaveBeenCalled();
});

test.each([
  ['stderr', 'find failed', ''],
  ['stdout', '', 'find output'],
])('reports remote script listing failures from %s', async (_label, stderr, stdout) => {
  mocks.exec.mockResolvedValue({ code: 1, stdout, stderr });
  await expect(backup({ target: 'vyos@router', config: '/tmp/backup' }))
    .rejects.toThrow(`could not list remote scripts: ${stderr || stdout}`);
  expect(mocks.close).toHaveBeenCalled();
});

test('closes SSH when downloading the backup fails', async () => {
  mocks.download.mockRejectedValueOnce(new Error('config download failed'));
  await expect(backup({ target: 'vyos@router', config: '/tmp/backup' }))
    .rejects.toThrow('config download failed');
  expect(mocks.close).toHaveBeenCalled();
});

test('does not enumerate scripts when config download fails', async () => {
  mocks.download.mockRejectedValueOnce(new Error('config download failed'));
  await expect(backup({ target: 'vyos@router', config: '/tmp/backup' })).rejects.toThrow();
  expect(mocks.exec).not.toHaveBeenCalled();
});
