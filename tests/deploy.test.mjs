import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jest } from '@jest/globals';

const fsMocks = { readdir: jest.fn(), stat: jest.fn() };
const logMock = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
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
  log: logMock,
}));
jest.unstable_mockModule('../src/ssh.mjs', () => mocks);
const { cleanupActiveDeployments, deploy } = await import('../src/deploy.mjs');

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
  mocks.interactive.mockImplementation(async (_client, commands, _log, onCommandComplete) => {
    commands.forEach(item => onCommandComplete?.(typeof item === 'string' ? item : item.command));
    return '';
  });
});

test('deploys config, downloads live state, and logs when debug is enabled', async () => {
  process.env.VYOPS_DEBUG = 'true';
  mocks.interactive.mockImplementation(async (_client, commands, _log, onComplete) => {
    commands.forEach(item => onComplete?.(typeof item === 'string' ? item : item.command));
    return 'vyos# compare\n[system]\n+ host-name test\n\nvyos# printf x';
  });
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
  const commandNames = commands.map(item => typeof item === 'string' ? item : item.command);
  expect(commandNames.indexOf('run set terminal length 0')).toBeLessThan(commandNames.indexOf("printf '%s\\n' '--- compare ---'"));
  expect(commands.find(item => item.command === 'commit-confirm 5').reject.test('WARNING: update-check unable to retrieve data: ConnectionError')).toBe(false);
  expect(commands.find(item => item.command === 'commit-confirm 5').reject.test('configuration commit failed')).toBe(true);
});

test('rejects a completed interactive session without commit confirmation', async () => {
  mocks.interactive.mockResolvedValue('');
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot' }))
    .rejects.toThrow('without confirming the commit');
});

test('cleans active deployment staging on interruption', async () => {
  let releaseInteractive;
  mocks.interactive.mockImplementation((_client, _commands, _log, onComplete) => new Promise(resolve => {
    onComplete?.('confirm');
    releaseInteractive = resolve;
  }));
  const deployment = deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot' });
  await new Promise(resolve => setImmediate(resolve));
  mocks.connect.mockRejectedValueOnce(new Error('reconnect unavailable'));
  await cleanupActiveDeployments();
  expect(logMock.warn).toHaveBeenCalledWith(expect.stringMatching(/interruption cleanup failed.*reconnect unavailable/i));
  releaseInteractive('');
  await deployment;
});

test('reconnects and removes staging during successful interruption cleanup', async () => {
  let releaseInteractive;
  mocks.interactive.mockImplementation((_client, _commands, _log, onComplete) => new Promise(resolve => {
    onComplete?.('confirm');
    releaseInteractive = resolve;
  }));
  const deployment = deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot' });
  await new Promise(resolve => setImmediate(resolve));
  await cleanupActiveDeployments();
  expect(mocks.connect.mock.calls.length).toBeGreaterThanOrEqual(3);
  expect(mocks.exec.mock.calls.some(([, command]) => command.includes('.config.deploy.') && command.includes('.scripts-backup.'))).toBe(true);
  releaseInteractive('');
  await deployment;
});

test('reports failed recovery reconnects through debug output', async () => {
  const failure = new Error('deployment transport failed');
  mocks.interactive.mockRejectedValue(failure);
  mocks.connect.mockImplementation(async () => {
    if (mocks.connect.mock.calls.length >= 3) throw new Error('recovery reconnect failed');
    return client();
  });
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot' })).rejects.toBe(failure);
  expect(logMock.debug).toHaveBeenCalledWith(expect.stringMatching(/recovery reconnect failed/));
});

test('builds binary staging validation with hash verification', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-binary-'));
  const scripts = join(root, 'scripts');
  await mkdir(scripts, { recursive: true });
  await writeFile(join(scripts, 'helper.exe'), Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
  try {
    fsMocks.readdir.mockResolvedValue([{ name: 'helper.exe', isFile: () => true }]);
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot'), verifyBinaries: true })).resolves.toBe(0);
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('sha256sum') && command.includes('uname -m'))).toBe(true);
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot'), verifyBinaries: false })).resolves.toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('reports remote script validation failures without output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-remote-check-'));
  const scripts = join(root, 'scripts');
  await mkdir(scripts, { recursive: true });
  await writeFile(join(scripts, 'check.sh'), '#!/bin/sh\n');
  try {
    fsMocks.readdir.mockResolvedValue([{ name: 'check.sh', isFile: () => true }]);
    mocks.exec.mockImplementation(async (_client, command) => command.includes('! grep -q')
      ? { code: 1, stdout: '', stderr: '' }
      : { code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') }))
      .rejects.toThrow(/remote script preflight failed \(check\.sh\).*mode or line-ending check failed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('warns when live scripts are absent from the previous manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-stale-'));
  try {
    await writeFile(join(root, 'config.boot'), 'system {}\n');
    await writeFile(`${join(root, 'config.boot')}.manifest.tsv`, 'kind\tpath\tpreexisting\nfile\tmanaged.sh\tfalse\n');
    fsMocks.readdir.mockResolvedValue([]);
    mocks.exec.mockImplementation(async (_client, command) => command.includes('find -P /config/scripts')
      ? { code: 0, stdout: '/config/scripts/manual.sh\0', stderr: '' }
      : { code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') })).resolves.toBe(0);
    expect(logMock.warn).toHaveBeenCalledWith(expect.stringMatching(/unmanaged script files.*fresh backup/i));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('restores a previously managed file through the manifest on failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-rollback-'));
  const hooks = join(root, 'scripts');
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, 'managed.sh'), '#!/bin/sh\n');
  await writeFile(`${join(root, 'config.boot')}.manifest.tsv`, 'kind\tpath\tpreexisting\nfile\tmanaged.sh\ttrue\n');
  try {
    fsMocks.readdir.mockResolvedValue([{ name: 'managed.sh', isFile: () => true }]);
    mocks.interactive.mockRejectedValue(new Error('deployment failed'));
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') })).rejects.toThrow('deployment failed');
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('cp -p') && command.includes('.scripts-backup.'))).toBe(true);
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('cp -a') && command.includes('.scripts-backup.'))).toBe(true);
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('rm -rf -- /config/scripts'))).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('marks every deployment phase explicitly', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-deploy-'));
  const scripts = join(root, 'scripts');
  await mkdir(scripts, { recursive: true });
  await writeFile(join(scripts, 'hook.sh'), '#!/bin/sh\n');
  try {
    fsMocks.readdir.mockResolvedValue([{ name: 'hook.sh', isFile: () => true }]);
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') })).resolves.toBe(0);
    const phases = mocks.interactive.mock.calls[0][1].filter(item => item?.phase).map(item => item.phase);
    expect(phases).toEqual(['load candidate', 'compare', 'compare', 'commit-confirm', 'confirm', 'save']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
  mocks.exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockRejectedValue(new Error('cleanup failed'));
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
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('sudo rm -f') && command.includes('/config/scripts/') && !command.includes('.vyops-'))).toBe(false);
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('sudo rm -rf') && command.includes('.scripts-backup.'))).toBe(true);
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
    expect(mocks.exec.mock.calls.some(call => call[1].includes('sudo chown root:root'))).toBe(true);
    expect(mocks.exec.mock.calls.some(call => call[1].includes('sudo chmod 755'))).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('redacts secrets across the deployment debug and output paths', async () => {
  const secret = 'deployment-secret-value';
  mocks.interactive.mockImplementation(async (_client, commands, debug, onComplete) => {
    onComplete?.('confirm');
    debug(`remote transcript contains ${secret}`);
    return `vyos# compare\n+ secret ${secret}\n+ password=router-password token router-token\nvyos# printf x`;
  });
  mocks.exec.mockImplementation(async (_client, command) => command.startsWith('vbash -ic')
    ? { code: 0, stdout: `verification ${secret} password=verify-password token verify-token`, stderr: '' }
    : { code: 0, stdout: '', stderr: '' });
  await expect(deploy({ target: 'vyos@router', config: '/tmp/config.boot', password: secret, verify: true })).resolves.toBe(0);
  const output = JSON.stringify([...logMock.debug.mock.calls, ...logMock.info.mock.calls]);
  expect(output).not.toContain(secret);
  expect(output).not.toContain('router-password');
  expect(output).not.toContain('verify-password');
  expect(output).not.toContain('router-token');
  expect(output).not.toContain('verify-token');
  expect(output).toContain('[redacted]');
});

test('redacts quoted and header-style secrets from verification output', async () => {
  mocks.exec.mockImplementation(async (_client, command) => command.startsWith('vbash -ic')
    ? { code: 0, stdout: 'Password: "quoted-secret" TOKEN: \'single-secret\' authorization: Bearer-secret x-api-key: api-secret', stderr: '' }
    : { code: 0, stdout: '', stderr: '' });
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot', verify: true })).resolves.toBe(0);
  const output = logMock.info.mock.calls.flat().join('\n');
  expect(output).not.toMatch(/quoted-secret|single-secret|Bearer-secret|api-secret/);
  expect(output).toContain('[redacted]');
});

test('discards and reconnects the SSH client after a timeout', async () => {
  const timeout = Object.assign(new Error('interactive SSH timeout'), { code: 'VYOPS_TIMEOUT' });
  mocks.interactive.mockRejectedValue(timeout);
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot' }))
    .rejects.toBe(timeout);
  expect(mocks.connect).toHaveBeenCalledTimes(3);
  expect(mocks.close).toHaveBeenCalledTimes(3);
  expect(mocks.exec.mock.calls.some(([, command]) => command.includes('.config.deploy.') && command.includes('.scripts-backup.'))).toBe(true);
});

test('runs optional post-deployment verification commands', async () => {
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot', verify: true })).resolves.toBe(0);
  const commands = mocks.exec.mock.calls.map(([, command]) => command);
  expect(commands.filter(command => command.startsWith('vbash -ic')).map(command => JSON.parse(command.slice(10))))
    .toEqual(['show vrrp', 'show interfaces wireguard', 'show bgp summary', 'show ip route', 'show haproxy']);
});

test('fails when a verification command returns an error', async () => {
  mocks.exec.mockImplementation(async (_client, command) => command.startsWith('vbash -ic')
    ? { code: 1, stdout: '', stderr: 'verification failed' }
    : { code: 0, stdout: '', stderr: '' });
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot', verify: true }))
    .rejects.toThrow('verification phase failed (show vrrp): verification failed');
});

test('reports verification errors returned on stdout', async () => {
  mocks.exec.mockImplementation(async (_client, command) => command.startsWith('vbash -ic')
    ? { code: 1, stdout: 'verification stdout failure', stderr: '' }
    : { code: 0, stdout: '', stderr: '' });
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot', verify: true }))
    .rejects.toThrow('verification phase failed (show vrrp): verification stdout failure');
});

test('rejects before upload when remote preflight fails', async () => {
  mocks.exec.mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'sudo missing' });
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot' }))
    .rejects.toThrow('remote preflight failed: sudo missing');
  expect(mocks.upload).not.toHaveBeenCalled();
});

test.each([
  ['', 'router prerequisites are not satisfied'],
  ['preflight output', 'preflight output'],
])('reports remote preflight fallback text: %s', async (stdout, expected) => {
  mocks.exec.mockResolvedValueOnce({ code: 1, stdout, stderr: '' });
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot' }))
    .rejects.toThrow(`remote preflight failed: ${expected}`);
});

test('skips hooks when requested', async () => {
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot', noHooks: true })).resolves.toBe(0);
  expect(mocks.upload).toHaveBeenCalledTimes(1);
});

test('installs shell scripts as executable regardless of local mode', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-deploy-'));
  const scripts = join(root, 'scripts');
  await mkdir(scripts, { recursive: true });
  await writeFile(join(root, 'config.boot'), 'system {}\n');
  await writeFile(join(scripts, 'hook.sh'), '#!/bin/sh\n');
  await writeFile(join(scripts, 'helper.exe'), Buffer.from([0, 1, 2]));
  await writeFile(join(scripts, 'settings.env'), 'KEY=value\n');
  fsMocks.readdir.mockResolvedValue([
    { name: 'hook.sh', isFile: () => true },
    { name: 'helper.exe', isFile: () => true },
    { name: 'settings.env', isFile: () => true },
  ]);
  fsMocks.stat.mockResolvedValue({ mode: 0o100666 });
  try {
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot'), hasBinaryScripts: true, verifyBinaries: true })).resolves.toBe(0);
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('install -m 755'))).toBe(true);
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('install -m 666'))).toBe(true);
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('test -x'))).toBe(true);
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes("printf '\\r'"))).toBe(true);
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('file -b') && command.includes('uname -m'))).toBe(true);
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('sha256sum') && command.includes('helper.exe'))).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('aborts before interactive deployment when remote script validation fails', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-deploy-'));
  const scripts = join(root, 'scripts');
  await mkdir(scripts, { recursive: true });
  await writeFile(join(scripts, 'hook.sh'), '#!/bin/sh\n');
  fsMocks.readdir.mockResolvedValue([{ name: 'hook.sh', isFile: () => true }]);
  mocks.exec.mockImplementation(async (_client, command) => command.includes('printf \'\\r\'')
    ? { code: 1, stdout: '', stderr: 'CRLF detected' }
    : { code: 0, stdout: '', stderr: '' });
  try {
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') }))
      .rejects.toThrow('remote script preflight failed (hook.sh): CRLF detected');
    expect(mocks.interactive).not.toHaveBeenCalled();
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
      .mockResolvedValueOnce([{ name: '95-reconcile', isFile: () => true }]);
    fsMocks.stat.mockResolvedValue({ mode: 0o100666 });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') })).resolves.toBe(0);
    expect(mocks.upload).toHaveBeenCalledWith(expect.anything(), join(scripts, 'commit', 'post-hooks.d', '95-reconcile'), expect.stringContaining('/.scripts.'), 0o755);
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('install -m 755'))).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('skips an existing empty hook directory', async () => {
  fsMocks.readdir.mockResolvedValue([]);
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot' })).resolves.toBe(0);
  expect(mocks.exec).toHaveBeenCalledTimes(3);
});

test('ignores directory entries that are neither files nor directories', async () => {
  fsMocks.readdir.mockResolvedValue([{ name: 'ignored', isFile: () => false, isDirectory: () => false }]);
  await expect(deploy({ target: 'testuser@test-router.example.test', config: '/tmp/config.boot' })).resolves.toBe(0);
  expect(mocks.exec).toHaveBeenCalledTimes(3);
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
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 1, stdout, stderr })
      .mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') }))
    .rejects.toThrow(`script upload directory setup failed (${join('commit', 'hook.sh')}): ${stderr || stdout}`);
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('manifest.tsv') && command.includes('backup'))).toBe(true);
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('while IFS= read -r name'))).toBe(true);
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('directory') && command.includes('rmdir') && command.includes('sort -r'))).toBe(true);
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
    mocks.exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 1, stdout: 'setup out', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') })).rejects.toThrow('script directory setup failed: setup out');
    mocks.exec.mockReset();
    fsMocks.readdir.mockResolvedValueOnce([{ name: 'hook.sh', isFile: () => true }]);
    mocks.exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'install err' }).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') })).rejects.toThrow('script install failed (hook.sh): install err');
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('manifest.tsv') && command.includes('backup'))).toBe(true);
    expect(mocks.exec.mock.calls.some(([, command]) => command.includes('while IFS= read -r name') && command.includes('false'))).toBe(true);
    mocks.exec.mockReset();
    mocks.exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }).mockResolvedValueOnce({ code: 1, stdout: 'install out', stderr: '' }).mockResolvedValue({ code: 0, stdout: '', stderr: '' });
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
    mocks.exec.mockImplementation(async (_client, command) => command.includes('sudo rm -rf') && command.includes('scripts-backup')
      ? Promise.reject(new Error('hook cleanup failed'))
      : { code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') })).resolves.toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('uses a separate cleanup client and reports hook cleanup failure after reconnect failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vyops-deploy-'));
  const hooks = join(root, 'scripts');
  await mkdir(hooks, { recursive: true });
  await writeFile(join(hooks, 'hook.sh'), '#!/bin/sh\n');
  const initial = client();
  const interactiveClient = client();
  const cleanupClient = client();
  fsMocks.readdir.mockResolvedValue([{ name: 'hook.sh', isFile: () => true }]);
  mocks.connect
    .mockResolvedValueOnce(initial)
    .mockResolvedValueOnce(interactiveClient)
    .mockRejectedValueOnce(new Error('recovery unavailable'))
    .mockResolvedValueOnce(cleanupClient);
  mocks.interactive.mockRejectedValueOnce(new Error('deployment failed'));
  mocks.exec.mockImplementation(async (_client, command) => {
    if (command.includes('sudo rm -rf --') && command.includes('scripts-backup')) throw new Error('hook cleanup failed');
    return { code: 0, stdout: '', stderr: '' };
  });
  try {
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') }))
      .rejects.toThrow('deployment failed');
    expect(mocks.close).toHaveBeenCalledWith(cleanupClient);
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
    mocks.exec.mockImplementation(async (_client, command) => command.includes("$3 == \"false\"")
      ? Promise.reject(new Error('rollback cleanup failed'))
      : { code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') }))
      .rejects.toThrow('deployment failed');
    expect(mocks.exec).toHaveBeenCalledTimes(9);
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
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 1, stdout: '', stderr: 'backup err' })
      .mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') }))
      .rejects.toThrow('script backup failed (hook.sh): backup err');

    mocks.exec.mockReset();
    mocks.exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 1, stdout: 'backup out', stderr: '' })
      .mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') }))
      .rejects.toThrow('script backup failed (hook.sh): backup out');

    mocks.exec.mockReset();
    mocks.exec.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ code: 1, stdout: 'install out', stderr: '' })
      .mockRejectedValueOnce(new Error('install rollback failed'))
      .mockResolvedValue({ code: 0, stdout: '', stderr: '' });
    await expect(deploy({ target: 'testuser@test-router.example.test', config: join(root, 'config.boot') }))
      .rejects.toThrow('script install failed (hook.sh): install out');
    expect(logMock.warn).toHaveBeenCalledWith(expect.stringMatching(/cleanup warning: script rollback failed: install rollback failed/i));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
