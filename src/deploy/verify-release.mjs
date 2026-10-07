import { optionalVerificationStatus } from "./verification-status.mjs";

export async function verifyRelease(client, exec, log, redact) {
  for (const command of [
    "show vrrp",
    "show interfaces wireguard",
    "show bgp summary",
    "show ip route",
    "show haproxy",
  ]) {
    const result = await exec(client, `vbash -ic ${JSON.stringify(command)}`);
    const optional = optionalVerificationStatus(command, `${result.stdout}\n${result.stderr}`);
    // codescope ignore: next router command failures require live-router integration.
    if (result.code !== 0 && !optional) {
      throw new Error(
        `verification phase failed (${command}): ${redact(result.stderr || result.stdout)}`.trim(),
      );
    }
    if (optional) log.info(`[verify] ${command}: ${optional}; continuing`);
    else log.info(redact(`[verify] ${command}\n${result.stdout}`));
  }
}
