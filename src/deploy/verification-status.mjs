import { hasNoWireGuardInterfaces } from "./wireguard-status.mjs";

const optionalUnavailable = new Map([
  ["show vrrp", /^VRRP data is not available \(process not running or no active groups\)$/i],
  ["show bgp summary", /^% BGP instance not found$/i],
  ["show haproxy", /^haproxy is not configured$/i],
]);

export function optionalVerificationStatus(command, output, code) {
  if (
    /command not found|connection refused|permission denied|timed? out|operation failed/i.test(
      output,
    )
  )
    return null;
  if (code !== 0 && optionalUnavailable.get(command)?.test(output.trim()))
    return "optional check is not configured or active";
  if (command === "show interfaces wireguard" && hasNoWireGuardInterfaces(output))
    return "no WireGuard interfaces are configured";
  return null;
}
