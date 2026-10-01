import { optionalVerificationStatus } from '../../src/deploy/verification-status.mjs';

test.each([
  ['show vrrp', 'VRRP data is not available (process not running or no active groups)'],
  ['show bgp summary', '% BGP instance not found'],
  ['show haproxy', 'Haproxy is not configured'],
])('treats absent optional service as non-blocking for %s', (command, output) => {
  expect(optionalVerificationStatus(command, output)).toBe('optional feature is not configured or active');
});

test('treats an empty WireGuard table as no configured interfaces', () => {
  const output = 'Interface        IP Address\n---------        ----------\n';
  expect(optionalVerificationStatus('show interfaces wireguard', output)).toBe('no WireGuard interfaces are configured');
});

test('does not classify operational failures or route checks as optional absence', () => {
  expect(optionalVerificationStatus('show bgp summary', 'connection refused')).toBeNull();
  expect(optionalVerificationStatus('show ip route', '')).toBeNull();
});
