import { jest } from '@jest/globals';

const readdir = jest.fn();
const readFile = jest.fn();
const stat = jest.fn();
const exec = jest.fn();
const upload = jest.fn();
jest.unstable_mockModule('@eliware/common', () => ({
  fs: { promises: { readdir, readFile, stat } },
  path: (...parts) => parts.join('/'),
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.unstable_mockModule('../../src/ssh.mjs', () => ({ exec, upload }));
const { installScripts } = await import('../../src/deploy/script-sync.mjs');

test('returns no hook finalizer when the local script tree is absent', async () => {
  readdir.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));
  await expect(installScripts({}, '/tmp/config.boot', jest.fn(), 'run-id', false)).resolves.toBeNull();
  expect(exec).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
});

test('propagates local script tree errors other than missing directories', async () => {
  readdir.mockRejectedValueOnce(new Error('directory unavailable'));
  await expect(installScripts({}, '/tmp/config.boot', jest.fn(), 'run-id', false)).rejects.toThrow('directory unavailable');
});

beforeEach(() => {
  jest.clearAllMocks();
  readFile.mockResolvedValue(Buffer.from('#!/bin/sh\necho ok\n'));
  stat.mockResolvedValue({ mode: 0o100755 });
  exec.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  upload.mockResolvedValue(undefined);
});

test('stages, validates, installs, and finalizes a script tree', async () => {
  readdir.mockResolvedValueOnce([{ name: 'health.sh', isFile: () => true, isDirectory: () => false }]);
  const debug = jest.fn();
  const finalize = await installScripts({}, '/tmp/config.boot', debug, 'run-id', true);
  expect(upload).toHaveBeenCalledWith({}, '/tmp/config.boot/../scripts/health.sh', '/home/vyos/.scripts.run-id/health.sh', 0o755);
  expect(exec.mock.calls.some(([, command]) => command.includes('sha256sum'))).toBe(true);
  await finalize(true, {});
  expect(exec.mock.calls.at(-1)[1]).toContain('rm -rf');
  expect(debug).toHaveBeenCalledWith('installed script: health.sh');
});

test('rejects control characters before uploading a script', async () => {
  readdir.mockResolvedValueOnce([{ name: 'bad\nname.sh', isFile: () => true, isDirectory: () => false }]);
  await expect(installScripts({}, '/tmp/config.boot', jest.fn(), 'run-id', false)).rejects.toThrow('script path is invalid');
  expect(upload).not.toHaveBeenCalled();
});

test('reports failed live inspection and rolls back after an install failure', async () => {
  readdir.mockResolvedValueOnce([{ name: 'health.sh', isFile: () => true, isDirectory: () => false }]);
  exec.mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'permission denied' });
  await expect(installScripts({}, '/tmp/config.boot', jest.fn(), 'run-id', false)).rejects.toThrow(/live script inspection failed/);
  expect(exec).toHaveBeenCalledTimes(1);

  jest.clearAllMocks();
  readdir.mockResolvedValueOnce([{ name: 'health.sh', isFile: () => true, isDirectory: () => false }]);
  exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
    .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
    .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
    .mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'bad mode' })
    .mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  await expect(installScripts({}, '/tmp/config.boot', jest.fn(), 'run-id', false)).rejects.toThrow(/remote script preflight failed/);
  expect(exec.mock.calls.length).toBeGreaterThan(4);
});

test('uses the live inspection fallback when no diagnostic output is available', async () => {
  readdir.mockResolvedValueOnce([{ name: 'health.sh', isFile: () => true, isDirectory: () => false }]);
  exec.mockResolvedValueOnce({ code: 1, stdout: '', stderr: '' });
  await expect(installScripts({}, '/tmp/config.boot', jest.fn(), 'run-id', false)).rejects.toThrow('live script inspection failed');
});

test('continues when live inspection reports a missing command environment', async () => {
  readdir.mockResolvedValueOnce([{ name: 'health.sh', isFile: () => true, isDirectory: () => false }]);
  exec.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));
  const finalize = await installScripts({}, '/tmp/config.boot', jest.fn(), 'run-id', false);
  expect(upload).toHaveBeenCalled();
  await finalize(true, {});
});

test('creates and uploads nested script directories', async () => {
  readdir.mockResolvedValueOnce([{ name: 'health/check.sh', isFile: () => true, isDirectory: () => false }]);
  const finalize = await installScripts({}, '/tmp/config.boot', jest.fn(), 'run-id', false);
  expect(exec.mock.calls.some(([, command]) => command.includes('/home/vyos/.scripts.run-id/health'))).toBe(true);
  expect(upload).toHaveBeenCalledWith({}, '/tmp/config.boot/../scripts/health/check.sh', '/home/vyos/.scripts.run-id/health/check.sh', 0o755);
  await finalize(true, {});
});

test('reports nested script directory setup failures', async () => {
  readdir.mockResolvedValueOnce([{ name: 'health/check.sh', isFile: () => true, isDirectory: () => false }]);
  exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
    .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
    .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
    .mockResolvedValueOnce({ code: 1, stdout: '', stderr: '' })
    .mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  await expect(installScripts({}, '/tmp/config.boot', jest.fn(), 'run-id', false)).rejects.toThrow(/script upload directory setup failed/);
});

test('surfaces manifest update failures after atomic installation', async () => {
  readdir.mockResolvedValueOnce([{ name: 'health.sh', isFile: () => true, isDirectory: () => false }]);
  exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
    .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
    .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
    .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
    .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
    .mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'manifest denied' })
    .mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  await expect(installScripts({}, '/tmp/config.boot', jest.fn(), 'run-id', false)).rejects.toThrow(/manifest update failed/);
});

test('uses the manifest update fallback when no diagnostic output is available', async () => {
  readdir.mockResolvedValueOnce([{ name: 'health.sh', isFile: () => true, isDirectory: () => false }]);
  exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
    .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
    .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
    .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
    .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
    .mockResolvedValueOnce({ code: 1, stdout: '', stderr: '' })
    .mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  await expect(installScripts({}, '/tmp/config.boot', jest.fn(), 'run-id', false)).rejects.toThrow(/manifest update failed/);
});
