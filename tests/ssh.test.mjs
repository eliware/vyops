import { EventEmitter } from 'node:events';
import { writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jest } from '@jest/globals';

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
      writeFile: (remote, data, callback) => callback(null),
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

jest.unstable_mockModule('ssh2', () => ({ default: { Client: MockClient, utils: { parseKey: () => ({ getPublicSSH: () => Buffer.alloc(0) }) } } }));
const { connect, exec, upload, download, interactive, closeAll } = await import('../src/ssh.mjs');

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
  operationClient.sftpClient.writeFile = (_remote, _data, callback) => callback(new Error('write failed'));
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
  stream.emit('data', '\nrouter#');
  expect(stream.writes).toEqual(['first\n', ' ', 'second\n']);
  stream.stderr.emit('data', 'warning');
  stream.emit('data', 'Proceed? [Y/n]');
  expect(stream.writes).toEqual(['first\n', ' ', 'second\n', 'y\n']);
  stream.emit('data', '\nrouter#');
  await expect(promise).resolves.toContain('Proceed? [Y/n]');
  stream.emit('data', '\nrouter#');
  expect(stream.ended).toBe(true);
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

  jest.useFakeTimers();
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
