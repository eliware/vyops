import { jest } from '@jest/globals';

const exec = jest.fn();
jest.unstable_mockModule('../../src/ssh.mjs', () => ({
  close: jest.fn(), connect: jest.fn(), download: jest.fn(), exec,
}));
const { validateRemoteScript } = await import('../../src/backup/remote-script.mjs');

beforeEach(() => exec.mockReset());

test('accepts a stable regular remote script', async () => {
  exec.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  await expect(validateRemoteScript(exec, {}, '/config/scripts/hook.sh')).resolves.toBeUndefined();
  expect(exec).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('realpath'));
});

test('rejects a remote script whose metadata check fails', async () => {
  exec.mockResolvedValue({ code: 1, stdout: '', stderr: 'changed' });
  await expect(validateRemoteScript(exec, {}, '/config/scripts/hook.sh'))
    .rejects.toThrow('remote script changed or is not a regular file: /config/scripts/hook.sh');
});
