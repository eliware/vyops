import { jest } from '@jest/globals';

const sharedConnect = jest.fn();
const debug = jest.fn();
jest.unstable_mockModule('@eliware/common', () => ({ log: { debug } }));
jest.unstable_mockModule('@eliware/ssh-client', () => ({ connect: sharedConnect }));
const { connect } = await import('../../src/ssh/connection.mjs');

beforeEach(() => { jest.clearAllMocks(); sharedConnect.mockResolvedValue({ raw: {} }); });

test('establishes and registers a configured SSH client', async () => {
  const register = jest.fn();
  const client = await connect('vyos@router.example.test', { register });
  expect(client.__vyopsTarget).toBe('vyos@router.example.test');
  expect(client.__vyopsPhase).toBe('connect');
  expect(register).toHaveBeenCalledWith(client);
  expect(sharedConnect).toHaveBeenCalledWith(expect.objectContaining({ host: 'router.example.test', username: 'vyos' }));
});

test('establishes a client without a registration callback', async () => {
  await expect(connect('vyos@router.example.test')).resolves.toHaveProperty('__vyopsPhase', 'connect');
});

test('adapts reusable connections and forwards interactive terminal dimensions', async () => {
  const stream = { on: jest.fn(), stderr: { on: jest.fn() }, write: jest.fn(), end: jest.fn(), close: jest.fn() };
  const reusable = {
    exec: jest.fn().mockResolvedValue([{ stdout: 'ok', stderr: '', code: 0 }]),
    shell: jest.fn().mockResolvedValue(stream),
    close: jest.fn().mockResolvedValue(undefined),
  };
  sharedConnect.mockResolvedValueOnce(reusable);
  const client = await connect('vyos@router.example.test');
  const shell = await new Promise((resolve, reject) => client.shell({ term: 'xterm', cols: 160, rows: 48 }, (error, value) => error ? reject(error) : resolve(value)));
  expect(shell).toBe(stream);
  expect(reusable.shell).toHaveBeenCalledWith({ term: 'xterm', cols: 160, rows: 48 });
});
