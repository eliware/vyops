const optionalUnavailable = new Map([
  ['show vrrp', /VRRP data is not available/i],
  ['show bgp summary', /BGP instance not found/i],
  ['show haproxy', /haproxy is not configured/i],
]);

function hasNoWireGuardInterfaces(output) {
  const lines = output.split(/\r?\n/);
  const header = lines.findIndex(line => /^\s*Interface\s+IP Address\b/i.test(line));
  if (header < 0) return false;
  const separator = lines.findIndex((line, index) => index > header && /^\s*-{3,}\s+-{3,}/.test(line));
  return separator >= 0 && lines.slice(separator + 1).every(line => !line.trim());
}

export function optionalVerificationStatus(command, output) {
  if (optionalUnavailable.get(command)?.test(output)) return 'optional feature is not configured or active';
  if (command === 'show interfaces wireguard' && hasNoWireGuardInterfaces(output)) return 'no WireGuard interfaces are configured';
  return null;
}
