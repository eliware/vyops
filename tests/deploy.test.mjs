import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jest } from '@jest/globals';

const fsMocks = { readdir: jest.fn(), stat: jest.fn() };
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
  fsMocks.stat.mockResolvedValue({ mode: 0o100755 });
  mocks.connect.mockResolvedValue(client());
  mocks.download.mockResolvedValue(undefined);
  mocks.exec.mockResolvedValue({ code: 0, stdout: '', stderr: '' });
  mocks.interactive.mockResolvedValue('');
});

test('extracts only compare results from the interactive transcript', () => {
  const output = `--- compare ---\n[edit]\ntestuser@test-router.example.test# compare\n[system login banner]\n- post-login "GitOps deployment test v2"\n+ post-login ""\n\ntestuser@test-router.example.test# printf '%s\\n' '--- end compare ---'`;
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
  const result = await deploy({ target: 'testuser@test-router.example.test', config });
  expect(result).toBe(0);
  expect(mocks.connect).toHaveBeenCalledTimes(3);
  expect(mocks.connect).toHaveBeenCalledWith('testuser@test-router.example.test');
  expect(mocks.upload).toHaveBeenCalledWith(expect.anything(), config, expect.stringMatching(/^\/home\/vyos\/\.config\.deploy\.[0-9a-f-]{36}$/));
  expect(mocks.download).toHaveBeenCalledWith(expect.anything(), '/config/config.boot', config);
});

test('deploys without compare output when debug is disabled', async () => {
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot' })).resolves.toBe(0);
  const commands = mocks.interactive.mock.calls[0][1];
  expect(commands).toEqual(expect.arrayContaining([expect.objectContaining({ command: 'commit-confirm 5' })]));
  expect(commands.indexOf('run set terminal length 0')).toBeLessThan(commands.indexOf("printf '%s\\n' '--- compare ---'"));
  expect(commands.find(item => item.command === 'commit-confirm 5').reject.test('WARNING: update-check unable to retrieve data: ConnectionError')).toBe(false);
  expect(commands.find(item => item.command === 'commit-confirm 5').reject.test('configuration commit failed')).toBe(true);
});

test('reconnects before opening the interactive deployment shell', async () => {
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot' })).resolves.toBe(0);
  expect(mocks.close).toHaveBeenCalledTimes(3);
  expect(mocks.connect).toHaveBeenCalledTimes(3);
  expect(mocks.interactive.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.close.mock.invocationCallOrder[0]);
});

test('passes bootstrap passwords through to SSH without logging them', async () => {
  await expect(deploy({ target: 'vyos@router', config: '/tmp/config.boot', password: 'bootstrap-secret' })).resolves.toBe(0);
  expect(mocks.connect).toHaveBeenCalledWith('vyos@router', { password: 'bootstrap-secret' });
});

test('rejects router failures and always cleans up', async () => {
  mocks.interactive.mockRejectedValue(new Error('interactive command failed: commit-confirm 5'));
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot' })).rejects.toThrow('interactive command failed: commit-confirm 5');
  expect(mocks.exec).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('rm -f --'));
});

test('propagates download failures and tolerates cleanup failures', async () => {
  mocks.download.mockRejectedValue(new Error('download failed'));
  mocks.exec.mockRejectedValue(new Error('cleanup failed'));
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot' })).rejects.toThrow('download failed');
});

test('does not roll back committed hooks when syncing the config fails', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-deploy-'));
  const hooks = join(root, 'scripts');
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, 'hook.sh'), '#!/bin/sh\n');
  try {
    fsMocks.readdir.mockResolvedValue([{ name: 'hook.sh', isFile: () => true }]);
    mocks.download.mockRejectedValue(new Error('download failed'));
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') }))
      .rejects.toThrow('download failed');
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('sudo rm -f') && command.includes('/config/scripts/'))).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('installs sorted post-commit hooks and cleans its remote directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-deploy-'));
  const hooks = join(root, 'scripts');
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, 'b.sh'), '#!/bin/sh\n');
  await writeFile(join(hooks, 'a.sh'), '#!/bin/sh\n');
  try {
    fsMocks.readdir.mockResolvedValue([{ name: 'b.sh', isFile: () => true }, { name: 'a.sh', isFile: () => true }]);
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') })).resolves.toBe(0);
    expect(mocks.upload.mock.calls.slice(1).map(call => call[1])).toEqual([join(hooks, 'a.sh'), join(hooks, 'b.sh')]);
    expect(mocks.exec.mock.calls.some(call => call[1].includes('sudo install'))).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('recursively installs the complete scripts tree', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-deploy-'));
  const scripts = join(root, 'scripts');
  await mkdir(join(scripts, 'commit', 'post-hooks.d'), { recursive: true });
  try {
    fsMocks.readdir
      .mockResolvedValueOnce([{ name: 'commit', isDirectory: () => true }])
      .mockResolvedValueOnce([{ name: 'post-hooks.d', isDirectory: () => true }])
      .mockResolvedValueOnce([{ name: 'check.sh', isFile: () => true }]);
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') })).resolves.toBe(0);
    expect(mocks.upload).toHaveBeenCalledWith(expect.anything(), join(scripts, 'commit', 'post-hooks.d', 'check.sh'), expect.stringContaining('/.scripts.'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('skips an existing empty hook directory', async () => {
  fsMocks.readdir.mockResolvedValue([]);
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot' })).resolves.toBe(0);
  expect(mocks.exec).toHaveBeenCalledTimes(1);
});

test('ignores directory entries that are neither files nor directories', async () => {
  fsMocks.readdir.mockResolvedValue([{ name: 'ignored', isFile: () => false, isDirectory: () => false }]);
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot' })).resolves.toBe(0);
  expect(mocks.exec).toHaveBeenCalledTimes(1);
});

test.each([
  ['stderr', 'directory setup error', ''],
  ['stdout', '', 'directory setup output'],
])('reports nested script upload directory setup failures using %s', async (_label, stderr, stdout) => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-deploy-'));
  const scripts = join(root, 'scripts');
  await mkdir(join(scripts, 'commit'), { recursive: true });
  try {
    fsMocks.readdir
      .mockResolvedValueOnce([{ name: 'commit', isDirectory: () => true }])
      .mockResolvedValueOnce([{ name: 'hook.sh', isFile: () => true }]);
    mocks.exec
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 1, stdout, stderr })
      .mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') }))
    .rejects.toThrow(`script upload directory setup failed (${join('commit', 'hook.sh')}): ${stderr || stdout}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('hook setup and install failures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-deploy-'));
  const hooks = join(root, 'scripts');
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, 'hook.sh'), '#!/bin/sh\n');
  try {
    fsMocks.readdir.mockResolvedValue([{ name: 'hook.sh', isFile: () => true }]);
    mocks.exec.mockResolvedValueOnce({ code: 1, stdout: 'setup out', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') })).rejects.toThrow('script directory setup failed: setup out');
    mocks.exec.mockReset();
    fsMocks.readdir.mockResolvedValueOnce([{ name: 'hook.sh', isFile: () => true }]);
    mocks.exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'install err' }).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') })).rejects.toThrow('script install failed (hook.sh): install err');
    mocks.exec.mockReset();
    mocks.exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 1, stdout: 'install out', stderr: '' }).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    fsMocks.readdir.mockResolvedValueOnce([{ name: 'hook.sh', isFile: () => true }]);
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') })).rejects.toThrow('script install failed (hook.sh): install out');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('handles non-missing hook directory errors and hook cleanup errors', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-deploy-'));
  const hooks = join(root, 'scripts');
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, 'hook.sh'), '#!/bin/sh\n');
  try {
    fsMocks.readdir.mockRejectedValueOnce(new Error('permission denied'));
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') })).rejects.toThrow('permission denied');
    fsMocks.readdir.mockResolvedValueOnce([{ name: 'hook.sh', isFile: () => true }]);
    mocks.exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockRejectedValueOnce(new Error('hook cleanup failed')).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') })).resolves.toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects unsafe post-commit hook names', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-deploy-'));
  try {
    fsMocks.readdir.mockResolvedValue([{ name: '../hook.sh', isFile: () => true }]);
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') }))
      .rejects.toThrow('script path is invalid');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('tolerates hook rollback cleanup failures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-deploy-'));
  const hooks = join(root, 'scripts');
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, 'hook.sh'), '#!/bin/sh\n');
  try {
    fsMocks.readdir.mockResolvedValue([{ name: 'hook.sh', isFile: () => true }]);
    mocks.interactive.mockRejectedValue(new Error('deployment failed'));
    mocks.exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockRejectedValueOnce(new Error('rollback cleanup failed'))
      .mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') }))
      .rejects.toThrow('deployment failed');
    expect(mocks.exec).toHaveBeenCalledTimes(5);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('reports hook backup failures and tolerates install rollback failures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-deploy-'));
  const hooks = join(root, 'scripts');
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, 'hook.sh'), '#!/bin/sh\n');
  try {
    fsMocks.readdir.mockResolvedValue([{ name: 'hook.sh', isFile: () => true }]);
    mocks.exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'backup err' })
      .mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') }))
      .rejects.toThrow('script backup failed (hook.sh): backup err');

    mocks.exec.mockReset();
    mocks.exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 1, stdout: 'backup out', stderr: '' })
      .mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') }))
      .rejects.toThrow('script backup failed (hook.sh): backup out');

    mocks.exec.mockReset();
    mocks.exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 1, stdout: 'install out', stderr: '' })
      .mockRejectedValueOnce(new Error('install rollback failed'))
      .mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') }))
      .rejects.toThrow('script install failed (hook.sh): install out');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
