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
