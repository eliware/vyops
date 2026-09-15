import { jest } from '@jest/globals';

const readFile = jest.fn();
const debug = jest.fn();
jest.unstable_mockModule('@eliware/common', () => ({ fs: { promises: { readFile } }, log: { debug } }));
const { upload, download } = await import('../../src/ssh/file-transfer.mjs');

beforeEach(() => { jest.clearAllMocks(); readFile.mockResolvedValue(Buffer.from('data')); });

afterEach(() => { delete process.env.VYOPS_OPERATION_TIMEOUT; });

test('uploads data with the requested mode and closes SFTP', async () => {
  const sftp = { writeFile: jest.fn((_remote, _data, _options, done) => done()), end: jest.fn() };
  const client = { sftp: callback => callback(null, sftp) };
  await expect(upload(client, 'local', 'remote', 0o755)).resolves.toBeUndefined();
  expect(sftp.writeFile).toHaveBeenCalledWith('remote', Buffer.from('data'), { mode: 0o755 }, expect.any(Function));
  expect(sftp.end).toHaveBeenCalled();
});

test('downloads and propagates SFTP failures', async () => {
  const sftp = { fastGet: jest.fn((_remote, _local, done) => done(new Error('download failed'))), end: jest.fn() };
  const client = { sftp: callback => callback(null, sftp) };
  await expect(download(client, 'remote', 'local')).rejects.toThrow('download failed');
  expect(sftp.end).toHaveBeenCalled();
});

test('rejects upload when SFTP setup fails', async () => {
  const client = { sftp: callback => callback(new Error('sftp unavailable')) };
  await expect(upload(client, 'local', 'remote')).rejects.toThrow('sftp unavailable');
});

test('rejects upload on timeout and closes the SSH client', async () => {
  process.env.VYOPS_OPERATION_TIMEOUT = '1';
  const client = { sftp: jest.fn(), end: jest.fn() };
  await expect(upload(client, 'local', 'remote')).rejects.toMatchObject({ code: 'VYOPS_TIMEOUT' });
  expect(client.end).toHaveBeenCalled();
});

test('closes a late upload SFTP callback after timeout', async () => {
  process.env.VYOPS_OPERATION_TIMEOUT = '1';
  let callback;
  const lateSftp = { end: jest.fn() };
  const client = { sftp: value => { callback = value; }, end: jest.fn() };
  await expect(upload(client, 'local', 'remote')).rejects.toMatchObject({ code: 'VYOPS_TIMEOUT' });
  callback(null, lateSftp);
  expect(lateSftp.end).toHaveBeenCalled();
});

test('ignores duplicate upload callbacks', async () => {
  let done;
  const sftp = { writeFile: jest.fn((_remote, _data, _options, callback) => { done = callback; }), end: jest.fn() };
  const promise = upload({ sftp: callback => callback(null, sftp) }, 'local', 'remote');
  await new Promise(resolve => setImmediate(resolve));
  done();
  done(new Error('late failure'));
  await expect(promise).resolves.toBeUndefined();
});

test('propagates upload write failures', async () => {
  const sftp = { writeFile: jest.fn((_remote, _data, _options, callback) => callback(new Error('write failed'))), end: jest.fn() };
  await expect(upload({ sftp: callback => callback(null, sftp) }, 'local', 'remote')).rejects.toThrow('write failed');
});

test('downloads successfully and rejects download setup failures', async () => {
  const sftp = { fastGet: jest.fn((_remote, _local, done) => done()), end: jest.fn() };
  await expect(download({ sftp: callback => callback(null, sftp) }, 'remote', 'local')).resolves.toBeUndefined();
  await expect(download({ sftp: callback => callback(new Error('setup failed')) }, 'remote', 'local')).rejects.toThrow('setup failed');
});

test('rejects download on timeout and includes client context', async () => {
  process.env.VYOPS_OPERATION_TIMEOUT = '1';
  const client = { sftp: jest.fn(), end: jest.fn(), __vyopsDeploymentId: 'op', __vyopsTarget: 'router', __vyopsPhase: 'download' };
  await expect(download(client, 'remote', 'local')).rejects.toMatchObject({ code: 'VYOPS_TIMEOUT', message: expect.stringContaining('deployment=op target=router phase=download') });
  expect(client.end).toHaveBeenCalled();
});

test('closes a late download SFTP callback after timeout', async () => {
  process.env.VYOPS_OPERATION_TIMEOUT = '1';
  let callback;
  const lateSftp = { end: jest.fn() };
  const client = { sftp: value => { callback = value; }, end: jest.fn() };
  await expect(download(client, 'remote', 'local')).rejects.toMatchObject({ code: 'VYOPS_TIMEOUT' });
  callback(null, lateSftp);
  expect(lateSftp.end).toHaveBeenCalled();
});

test('ignores duplicate download callbacks', async () => {
  let done;
  const sftp = { fastGet: jest.fn((_remote, _local, callback) => { done = callback; }), end: jest.fn() };
  const promise = download({ sftp: callback => callback(null, sftp) }, 'remote', 'local');
  await new Promise(resolve => setImmediate(resolve));
  done();
  done(new Error('late failure'));
  await expect(promise).resolves.toBeUndefined();
});
