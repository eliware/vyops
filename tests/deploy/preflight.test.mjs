import { remotePreflight } from '../../src/deploy/preflight.mjs';
import { jest } from '@jest/globals';

test('checks base router requirements', async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  await remotePreflight(exec, {}, false, false);
  expect(exec.mock.calls[0][1]).toContain('command -v sudo');
});

test('adds HAProxy and binary requirements when requested', async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  await remotePreflight(exec, {}, true, true);
  expect(exec.mock.calls[0][1]).toContain('command -v haproxy');
  expect(exec.mock.calls[0][1]).toContain('command -v file');
});

test('reports router prerequisite failures', async () => {
  const exec = jest.fn().mockResolvedValue({ code: 1, stdout: '', stderr: 'sudo missing' });
  await expect(remotePreflight(exec, {}, false, false)).rejects.toThrow('remote preflight failed: sudo missing');
});
