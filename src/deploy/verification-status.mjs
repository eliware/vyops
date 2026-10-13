import { hasNoWireGuardInterfaces } from "./wireguard-status.mjs";

const optionalUnavailable = new Map([
  ["show vrrp", /VRRP data is not available/i],
  ["show bgp summary", /BGP instance not found/i],
  ["show haproxy", /haproxy is not configured/i],
]);

export function optionalVerificationStatus(command, output) {
  if (
    /command not found|connection refused|permission denied|timed? out|operation failed/i.test(
      output,
    )
  )
    return null;
  if (optionalUnavailable.get(command)?.test(output))
    return "optional feature is not configured or active";
  if (command === "show interfaces wireguard" && hasNoWireGuardInterfaces(output))
    return "no WireGuard interfaces are configured";
  return null;
}
