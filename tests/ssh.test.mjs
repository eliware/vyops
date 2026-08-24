import { EventEmitter } from 'node:events';
import { writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jest } from '@jest/globals';
import { fs } from '@eliware/common';
import { createHostVerifier } from '../../ssh-client/src/known-hosts.mjs';

class MockStream extends EventEmitter {
  constructor() {
    super();
    this.stderr = new EventEmitter();
    this.writes = [];
    this.closed = false;
    this.ended = false;
  }
  write(value) { this.writes.push(value); }
  end() { this.ended = true; }
  close() { this.closed = true; this.emit('close'); }
}

class MockClient extends EventEmitter {
  static instances = [];
  constructor() {
    super();
    this.shellStream = new MockStream();
    this.sftpClient = {
      writeFile: (remote, data, options, callback) => callback(null),
      fastGet: (remote, local, callback) => callback(null),
    };
    MockClient.instances.push(this);
  }
  once(event, handler) { return super.once(event, handler); }
  connect(options) {
    this.options = options;
    const error = MockClient.nextConnectError;
    MockClient.nextConnectError = null;
    queueMicrotask(() => this.emit(error ? 'error' : 'ready', error));
  }
  end() { this.emit('close'); }
  exec(command, callback) { this.execCallback?.(command, callback); }
  sftp(callback) { callback(null, this.sftpClient); }
  shell(options, callback) { this.shellOptions = options; callback(null, this.shellStream); }
}

jest.unstable_mockModule('@eliware/ssh-client', () => ({ connect: async options => {
  const client = new MockClient();
  const privateKeyPath = options.privateKeyPath || join(process.env.HOME, '.ssh/id_rsa');
  const privateKey = options.password === undefined ? await fs.promises.readFile(privateKeyPath) : undefined;
  if (options.knownHostsPath) await fs.promises.readFile(join(process.env.HOME, '.ssh/known_hosts'));
  let actual;
  const utils = { parseKey: key => { if (Buffer.isBuffer(key)) { if (key.length === 0) { actual = { getPublicSSH: () => ({}) }; return actual; } return {}; } return { getPublicSSH: () => ({ equals: value => value === actual }) }; } };
  const connectionOptions = { ...options, privateKey, hostVerifier: options.knownHostsPath ? createHostVerifier({ host: options.host, port: options.port, knownHostsPath: options.knownHostsPath, fsLib: fs.promises, homedirFn: () => process.env.HOME, utils }) : undefined };
  await new Promise((resolve, reject) => { client.once('ready', resolve); client.once('error', reject); client.connect(connectionOptions); });
  return { raw: client };
} }));
const { connect, exec, upload, download, interactive, close, closeAll, parseTarget } = await import('../src/ssh.mjs');

beforeEach(() => {
  MockClient.instances.length = 0;
  MockClient.nextConnectError = null;
  delete process.env.VYOPS_SSH_KEY;
  delete process.env.SSH_AUTH_SOCK;
  process.env.HOME = '/home/test';
});

test('connect parses user@host and resolves on ready', async () => {
  const keyDir = await mkdtemp(join(tmpdir(), 'ssh-test-'));
  const key = join(keyDir, 'key');
  await writeFile(key, 'private-key');
  await mkdir(join(keyDir, '.ssh'), { recursive: true });
  await writeFile(join(keyDir, '.ssh/known_hosts'), 'router ssh-ed25519 AAAA\n');
  process.env.HOME = keyDir;
  process.env.VYOPS_SSH_KEY = key;
  process.env.SSH_AUTH_SOCK = '/tmp/agent.sock';
  const promise = connect('vyos@router');
  const client = await promise;
  expect(client.options).toMatchObject({ host: 'router', username: 'vyos', agent: '/tmp/agent.sock', privateKey: Buffer.from('private-key') });
  expect(client.options.hostVerifier).toEqual(expect.any(Function));
  await rm(keyDir, { recursive: true, force: true });
});

test('connect uses the default key path', async () => {
  const keyDir = await mkdtemp(join(tmpdir(), 'ssh-test-'));
  process.env.HOME = keyDir;
  await mkdir(join(keyDir, '.ssh'), { recursive: true });
  await writeFile(join(keyDir, '.ssh/id_rsa'), 'default-key');
  await writeFile(join(keyDir, '.ssh/known_hosts'), 'router ssh-ed25519 AAAA\n');
  const client = await connect('vyos@router');
  expect(client.options.privateKey).toEqual(Buffer.from('default-key'));
  await rm(keyDir, { recursive: true, force: true });
});

test('connect supports password authentication without reading a private key', async () => {
  const keyDir = await mkdtemp(join(tmpdir(), 'ssh-test-'));
  process.env.HOME = keyDir;
  await mkdir(join(keyDir, '.ssh'), { recursive: true });
  await writeFile(join(keyDir, '.ssh/known_hosts'), 'router ssh-ed25519 AAAA\n');
  const client = await connect('vyos@router', { password: 'bootstrap-secret' });
  expect(client.options).toMatchObject({ username: 'vyos', password: 'bootstrap-secret' });
  expect(client.options.privateKey).toBeUndefined();
  await rm(keyDir, { recursive: true, force: true });
});

test('connect rejects host-only targets and connection errors', async () => {
  const keyDir = await mkdtemp(join(tmpdir(), 'ssh-test-'));
  const key = join(keyDir, 'key');
  await writeFile(key, 'key');
  await mkdir(join(keyDir, '.ssh'), { recursive: true });
  await writeFile(join(keyDir, '.ssh/known_hosts'), 'router ssh-ed25519 AAAA\n');
  process.env.HOME = keyDir;
  process.env.VYOPS_SSH_KEY = key;
  const error = new Error('connection failed');
  MockClient.nextConnectError = error;
  await expect(connect('router')).rejects.toThrow('invalid target');
  const promise = connect('vyos@router');
  await expect(promise).rejects.toThrow('connection failed');
  expect(MockClient.instances[0].options.username).toBe('vyos');
  await rm(keyDir, { recursive: true, force: true });
});

test('exec resolves output and defaults missing close code', async () => {
  const client = new MockClient();
  client.execCallback = (command, callback) => {
    expect(command).toBe('show version');
    const stream = new MockStream();
    callback(null, stream);
    stream.emit('data', 'out');
    stream.stderr.emit('data', 'err');
    stream.emit('close');
  };
  await expect(exec(client, 'show version')).resolves.toEqual({ code: 1, stdout: 'out', stderr: 'err' });
});

test('exec rejects command setup errors', async () => {
  const client = new MockClient();
  client.execCallback = (_command, callback) => callback(new Error('exec failed'));
  await expect(exec(client, 'bad')).rejects.toThrow('exec failed');
});

test('upload and download resolve on successful SFTP operations', async () => {
  const keyDir = await mkdtemp(join(tmpdir(), 'ssh-test-'));
  const local = join(keyDir, 'local');
  await writeFile(local, 'config');
  const client = new MockClient();
  await expect(upload(client, local, '/remote')).resolves.toBeUndefined();
  expect(client.sftpClient.writeFile).toBeDefined();
  await expect(download(client, '/remote', join(keyDir, 'copy'))).resolves.toBeUndefined();
  await rm(keyDir, { recursive: true, force: true });
});

test('upload and download reject SFTP and operation errors', async () => {
  const keyDir = await mkdtemp(join(tmpdir(), 'ssh-test-'));
  const local = join(keyDir, 'local');
  await writeFile(local, 'config');
  const client = new MockClient();
  client.sftp = callback => callback(new Error('sftp failed'));
  await expect(upload(client, local, '/remote')).rejects.toThrow('sftp failed');
  await expect(download(client, '/remote', join(keyDir, 'copy'))).rejects.toThrow('sftp failed');

  const operationClient = new MockClient();
  operationClient.sftpClient.writeFile = (_remote, _data, _options, callback) => callback(new Error('write failed'));
  operationClient.sftpClient.fastGet = (_remote, _local, callback) => callback(new Error('get failed'));
  await expect(upload(operationClient, local, '/remote')).rejects.toThrow('write failed');
  await expect(download(operationClient, '/remote', join(keyDir, 'copy'))).rejects.toThrow('get failed');
  await rm(keyDir, { recursive: true, force: true });
});

test('interactive runs commands, handles pager and commit confirmation', async () => {
  const client = new MockClient();
  const log = jest.fn();
  const promise = interactive(client, ['first', 'second'], log);
  const stream = client.shellStream;
  expect(stream.writes).toEqual(['first\n']);
  stream.emit('data', 'router output');
  stream.emit('data', '\n:');
  expect(stream.writes).toEqual(['first\n', ' ']);
  stream.emit('data', '\ntestuser@test-router.example.test#');
  expect(stream.writes).toEqual(['first\n', ' ', 'second\n']);
  stream.stderr.emit('data', 'warning');
  stream.emit('data', 'Proceed? [Y/n]');
  expect(stream.writes).toEqual(['first\n', ' ', 'second\n', 'yes\n']);
  stream.emit('data', '\ntestuser@test-router.example.test#');
  await expect(promise).resolves.toContain('Proceed? [Y/n]');
  stream.emit('data', '\ntestuser@test-router.example.test#');
  expect(stream.ended).toBe(true);
});

test('interactive handles VyOS return-only pager prompts', async () => {
  const client = new MockClient();
  const promise = interactive(client, ['first']);
  const stream = client.shellStream;
  stream.emit('data', 'No next tag (press RETURN)');
  expect(stream.writes).toEqual(['first\n', '\n']);
  stream.emit('close');
  await expect(promise).rejects.toThrow('interactive SSH closed before command sequence completed');
});

test('interactive rejects a failed structured command', async () => {
  const client = new MockClient();
  const promise = interactive(client, [{ command: 'save', reject: /save failed/i }]);
  client.shellStream.emit('data', 'save failed\ntestuser@test-router.example.test# ');
  await expect(promise).rejects.toThrow('interactive command failed: save');
});

test('interactive rejects a structured command error before a prompt arrives', async () => {
  const client = new MockClient();
  const promise = interactive(client, [{ command: 'commit-confirm 5', reject: /commit failed|error/i }]);
  client.shellStream.emit('data', 'Configuration commit failed; rollback in progress');
  await expect(promise).rejects.toThrow('interactive command failed: commit-confirm 5');
});

test('interactive reports structured failures without a matching detail line', async () => {
  const client = new MockClient();
  const promise = interactive(client, [{ command: 'load /tmp/config', reject: /^x/ }]);
  client.shellStream.emit('data', 'x');
  await expect(promise).rejects.toThrow('interactive command failed: load /tmp/config');
});

test('interactive rejects commit-confirm after VyOS reports a validation error', async () => {
  const client = new MockClient();
  const promise = interactive(client, [{ command: 'commit-confirm 5', reject: /(?:commit failed|commit aborted|invalid|error)/i }]);
  client.shellStream.emit('data', 'commit-confirm will automatically reload previous config in 5 minutes\nProceed ? [Y/n] ');
  expect(client.shellStream.writes).toEqual(['commit-confirm 5\n', 'yes\n']);
  client.shellStream.emit('data', 'Initialized commit-confirm; 5 minutes to confirm before reload\n[pki] Invalid private key on certificate "sangahnoona.com"');
  await expect(promise).rejects.toThrow('interactive command failed: commit-confirm 5 ([pki] Invalid private key on certificate "[redacted]")');
});

test('interactive handles an empty command list', async () => {
  const client = new MockClient();
  const promise = interactive(client, []);
  client.shellStream.emit('close');
  await expect(promise).resolves.toBe('');
});

test('interactive handles shell, stream, close, and timeout failures', async () => {
  const shellErrorClient = { shell: (_options, callback) => callback(new Error('shell failed')) };
  await expect(interactive(shellErrorClient, ['x'])).rejects.toThrow('shell failed');

  const errorClient = new MockClient();
  const errorPromise = interactive(errorClient, ['x']);
  errorClient.shellStream.emit('error', new Error('stream failed'));
  await expect(errorPromise).rejects.toThrow('stream failed');

  const closeClient = new MockClient();
  const closePromise = interactive(closeClient, ['x']);
  closeClient.shellStream.emit('close');
  await expect(closePromise).rejects.toThrow('interactive SSH closed before command sequence completed');

  const exitClient = new MockClient();
  const exitPromise = interactive(exitClient, ['exit']);
  exitClient.shellStream.emit('close');
  await expect(exitPromise).resolves.toBe('');

  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  const timeoutClient = new MockClient();
  const timeoutPromise = interactive(timeoutClient, ['x']);
  jest.advanceTimersByTime(60000);
  await expect(timeoutPromise).rejects.toThrow('interactive SSH timeout');
  expect(timeoutClient.shellStream.closed).toBe(true);
  jest.useRealTimers();
});

test('closeAll ends active SSH clients', async () => {
  const keyDir = await mkdtemp(join(tmpdir(), 'ssh-test-'));
  const key = join(keyDir, 'key');
  await writeFile(key, 'key');
  await mkdir(join(keyDir, '.ssh'), { recursive: true });
  await writeFile(join(keyDir, '.ssh/known_hosts'), 'router ssh-ed25519 AAAA\n');
  process.env.HOME = keyDir;
  process.env.VYOPS_SSH_KEY = key;
  await connect('vyos@router');
  closeAll();
  expect(MockClient.instances.at(-1).shellStream.closed).toBe(false);
  await rm(keyDir, { recursive: true, force: true });
});


test.each([undefined, '', 'router', '@router', 'vyos@', 'vyos@router@other', 'vy os@router', 'vyos@bad/host', 'vyos@[bad]'])('rejects invalid target %p', target => {
  expect(() => parseTarget(target)).toThrow('invalid target; expected user@host');
});

test('accepts valid target forms', () => {
  expect(parseTarget('vyos@router.example')).toEqual({ username: 'vyos', host: 'router.example' });
  expect(parseTarget('vyos@192.0.2.1')).toEqual({ username: 'vyos', host: '192.0.2.1' });
  expect(parseTarget('vyos@[2001:db8::1]')).toEqual({ username: 'vyos', host: '[2001:db8::1]' });
});

test('connect rejects missing known_hosts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ssh-test-'));
  await mkdir(join(dir, '.ssh'), { recursive: true });
  await writeFile(join(dir, '.ssh/id_rsa'), 'key');
  process.env.HOME = dir;
  await expect(connect('vyos@router')).rejects.toThrow();
  await rm(dir, { recursive: true, force: true });
});

test('host verifier accepts matching known host and rejects mismatch', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ssh-test-'));
  await mkdir(join(dir, '.ssh'), { recursive: true });
  await writeFile(join(dir, '.ssh/id_rsa'), 'key');
  await writeFile(join(dir, '.ssh/known_hosts'), '# comment\n\nrouter ssh-ed25519 AAAA\nmalformed\n');
  process.env.HOME = dir;
  const client = await connect('vyos@router');
  const verify = key => new Promise(resolve => client.options.hostVerifier(key, resolve));
  await expect(verify(Buffer.alloc(0))).resolves.toBe(true);
  await expect(verify(Buffer.from('mismatch'))).resolves.toBe(false);
  await rm(dir, { recursive: true, force: true });
});

test('host verifier handles revoked, negated, wildcard, and hashed entries', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ssh-test-'));
  await mkdir(join(dir, '.ssh'), { recursive: true });
  await writeFile(join(dir, '.ssh/id_rsa'), 'key');
  await writeFile(join(dir, '.ssh/known_hosts'), '@cert-authority router ssh-ed25519 AAAA\n@revoked router ssh-ed25519 AAAA\n*.example ssh-ed25519 AAAA\n|1|bad|bad ssh-ed25519 AAAA\n!router router ssh-ed25519 AAAA\n');
  process.env.HOME = dir;
  const client = await connect('vyos@router');
  await expect(new Promise(resolve => client.options.hostVerifier(Buffer.alloc(0), resolve))).resolves.toBe(false);
  await rm(dir, { recursive: true, force: true });
});

test('host verifier handles valid hashed and malformed key entries', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ssh-test-'));
  await mkdir(join(dir, '.ssh'), { recursive: true });
  await writeFile(join(dir, '.ssh/id_rsa'), 'key');
  const digest = await import('node:crypto').then(({ createHmac }) => createHmac('sha1', Buffer.from('salt')).update('router').digest('base64'));
  await writeFile(join(dir, '.ssh/known_hosts'), `|1|${Buffer.from('salt').toString('base64')}|${digest} ssh-ed25519 AAAA\nrouter badtype bad\n`);
  process.env.HOME = dir;
  const client = await connect('vyos@router');
  await expect(new Promise(resolve => client.options.hostVerifier(Buffer.alloc(0), resolve))).resolves.toBe(true);
  await rm(dir, { recursive: true, force: true });
});

test('host verifier rejects malformed hashes and matching negated hosts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ssh-test-'));
  await mkdir(join(dir, '.ssh'), { recursive: true });
  await writeFile(join(dir, '.ssh/id_rsa'), 'key');
  await writeFile(join(dir, '.ssh/known_hosts'), '|2|salt|digest ssh-ed25519 AAAA\n|1||| ssh-ed25519 AAAA\n!router router ssh-ed25519 AAAA\n');
  process.env.HOME = dir;
  const client = await connect('vyos@router');
  await expect(new Promise(resolve => client.options.hostVerifier(Buffer.alloc(0), resolve))).resolves.toBe(false);
  await rm(dir, { recursive: true, force: true });
});

test('exec handles stream errors and timeout', async () => {
  const client = new MockClient();
  client.execCallback = (_command, callback) => {
    const stream = new MockStream();
    callback(null, stream);
    stream.emit('error', new Error('stream error'));
  };
  await expect(exec(client, 'bad')).rejects.toThrow('stream error');
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  const timeoutClient = new MockClient();
  const promise = exec(timeoutClient, 'slow');
  jest.advanceTimersByTime(60000);
  await expect(promise).rejects.toThrow('SSH command timed out: slow');
  jest.useRealTimers();
});

test('SFTP upload and download time out', async () => {
  const readFile = jest.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('config'));
  jest.useFakeTimers();
  const client = new MockClient();
  client.sftpClient.writeFile = () => {};
  client.sftpClient.fastGet = () => {};
  const uploadPromise = upload(client, '/local', '/remote').catch(error => error);
  await Promise.resolve();
  await Promise.resolve();
  jest.advanceTimersByTime(60000);
  await expect(uploadPromise).resolves.toMatchObject({ message: 'SFTP upload timed out: /remote' });
  const downloadPromise = download(client, '/remote', '/local').catch(error => error);
  jest.advanceTimersByTime(60000);
  await expect(downloadPromise).resolves.toMatchObject({ message: 'SFTP download timed out: /remote' });
  jest.useRealTimers();
  readFile.mockRestore();
});

test('close handles null and error', async () => {
  await expect(close(null)).resolves.toBeUndefined();
  const client = new MockClient();
  const promise = close(client);
  client.emit('error', new Error('close error'));
  await expect(promise).resolves.toBeUndefined();
});
