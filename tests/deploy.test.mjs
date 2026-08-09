import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jest } from '@jest/globals';

const fsMocks = { readdir: jest.fn() };
const mocks = {
  connect: jest.fn(),
  download: jest.fn(),
  exec: jest.fn(),
  interactive: jest.fn(),
  upload: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};
jest.unstable_mockModule('@eliware/common', () => ({
  fs: { promises: fsMocks },
  path: (...segments) => join(...segments),
  log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.unstable_mockModule('../src/ssh.mjs', () => mocks);
const { deploy, extractCompare } = await import('../src/deploy.mjs');

function client() {
  return { end: jest.fn() };
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.VYOPS_DEBUG;
  fsMocks.readdir.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
  mocks.connect.mockResolvedValue(client());
  mocks.download.mockResolvedValue(undefined);
  mocks.exec.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  mocks.interactive.mockResolvedValue('');
});

test('extracts only compare results from the interactive transcript', () => {
  const output = `--- compare ---\n[edit]\nvyos@core1.purinton.us# compare\n[system login banner]\n- post-login "GitOps deployment test v2"\n+ post-login ""\n\nvyos@core1.purinton.us# printf '%s\\n' '--- end compare ---'`;
  expect(extractCompare(output)).toBe('[system login banner]\n- post-login "GitOps deployment test v2"\n+ post-login ""');
});

test('handles compare markers, no changes, ANSI, and unrelated output', () => {
  expect(extractCompare('x\nvyos# compare\n[edit]\n\n[system]\n- old\n+ new\n\nvyos# printf x')).toBe('[system]\n- old\n+ new');
  expect(extractCompare('vyos# compare\nNo changes between working and active configurations.\n\n[edit]\nvyos# printf x')).toBe('No changes between working and active configurations.');
  expect(extractCompare('\x1b[?1h\x1b=\rNo changes between working and active configurations.\x1b[m\r\n\x1b>[edit]\nvyos# printf x')).toBe('No changes between working and active configurations.');
  expect(extractCompare('no compare output')).toBe('');
});

test('deploys config, downloads live state, and logs when debug is enabled', async () => {
  process.env.VYOPS_DEBUG = 'true';
  mocks.interactive.mockResolvedValue('vyos# compare\n[system]\n+ host-name test\n\nvyos# printf x');
  const config = '/tmp/config.boot';
  const result = await deploy({ target: 'vyos@core1', config });
  expect(result).toBe(0);
  expect(mocks.connect).toHaveBeenCalledWith('vyos@core1');
  expect(mocks.upload).toHaveBeenCalledWith(expect.anything(), config, expect.stringMatching(/^\/home\/vyos\/\.config\.deploy\.[0-9a-f-]{36}$/));
  expect(mocks.download).toHaveBeenCalledWith(expect.anything(), '/config/config.boot', config);
});

test('deploys without compare output when debug is disabled', async () => {
  await expect(deploy({ target: 'vyos@core1', config: '/tmp/config.boot' })).resolves.toBe(0);
  expect(mocks.interactive.mock.calls[0][1]).toEqual(expect.arrayContaining([expect.objectContaining({ command: 'commit-confirm 5' })]));
});

test('rejects router failures and always cleans up', async () => {
  mocks.interactive.mockRejectedValue(new Error('interactive command failed: commit-confirm 5'));
  await expect(deploy({ target: 'vyos@core1', config: '/tmp/config.boot' })).rejects.toThrow('interactive command failed: commit-confirm 5');
  expect(mocks.exec).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('rm -f --'));
});

test('propagates download failures and tolerates cleanup failures', async () => {
  mocks.download.mockRejectedValue(new Error('download failed'));
  mocks.exec.mockRejectedValue(new Error('cleanup failed'));
  await expect(deploy({ target: 'vyos@core1', config: '/tmp/config.boot' })).rejects.toThrow('download failed');
});

test('installs sorted post-commit hooks and cleans its remote directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-deploy-'));
  const hooks = join(root, 'scripts', 'commit', 'post-hooks.d');
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, 'b.sh'), '#!/bin/sh\n');
  await writeFile(join(hooks, 'a.sh'), '#!/bin/sh\n');
  try {
    fsMocks.readdir.mockResolvedValue([{ name: 'b.sh', isFile: () => true }, { name: 'a.sh', isFile: () => true }]);
    await expect(deploy({ target: 'vyos@core1', config: join(root, 'config.boot') })).resolves.toBe(0);
    expect(mocks.upload.mock.calls.slice(1).map(call => call[1])).toEqual([join(hooks, 'a.sh'), join(hooks, 'b.sh')]);
    expect(mocks.exec.mock.calls.some(call => call[1].includes('sudo install'))).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('skips an existing empty hook directory', async () => {
  fsMocks.readdir.mockResolvedValue([]);
  await expect(deploy({ target: 'vyos@core1', config: '/tmp/config.boot' })).resolves.toBe(0);
  expect(mocks.exec).toHaveBeenCalledTimes(1);
});

test('hook setup and install failures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-deploy-'));
  const hooks = join(root, 'scripts', 'commit', 'post-hooks.d');
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, 'hook.sh'), '#!/bin/sh\n');
  try {
    fsMocks.readdir.mockResolvedValue([{ name: 'hook.sh', isFile: () => true }]);
    mocks.exec.mockResolvedValueOnce({ code: 1, stdout: 'setup out', stderr: '' });
    await expect(deploy({ target: 'vyos@core1', config: join(root, 'config.boot') })).rejects.toThrow('post-commit hook directory setup failed: setup out');
    mocks.exec.mockReset();
    fsMocks.readdir.mockResolvedValueOnce([{ name: 'hook.sh', isFile: () => true }]);
    mocks.exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'install err' }).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'vyos@core1', config: join(root, 'config.boot') })).rejects.toThrow('post-commit hook install failed (hook.sh): install err');
    mocks.exec.mockReset();
    mocks.exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 1, stdout: 'install out', stderr: '' }).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    fsMocks.readdir.mockResolvedValueOnce([{ name: 'hook.sh', isFile: () => true }]);
    await expect(deploy({ target: 'vyos@core1', config: join(root, 'config.boot') })).rejects.toThrow('post-commit hook install failed (hook.sh): install out');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('handles non-missing hook directory errors and hook cleanup errors', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-deploy-'));
  const hooks = join(root, 'scripts', 'commit', 'post-hooks.d');
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, 'hook.sh'), '#!/bin/sh\n');
  try {
    fsMocks.readdir.mockRejectedValueOnce(new Error('permission denied'));
    await expect(deploy({ target: 'vyos@core1', config: join(root, 'config.boot') })).rejects.toThrow('permission denied');
    fsMocks.readdir.mockResolvedValueOnce([{ name: 'hook.sh', isFile: () => true }]);
    mocks.exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockRejectedValueOnce(new Error('hook cleanup failed')).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'vyos@core1', config: join(root, 'config.boot') })).resolves.toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
