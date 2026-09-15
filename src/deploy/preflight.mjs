export async function remotePreflight(exec, client, hasHaproxyHooks, hasBinaryScripts) {
  const requirements = [
    'command -v sudo',
    'command -v systemctl',
    'test -d /config',
    'test -w /config',
    'test "$(df -Pk /config | awk \'NR==2 {print $4}\')" -gt 10240',
  ];
  if (hasHaproxyHooks) requirements.push('command -v haproxy');
  if (hasBinaryScripts) requirements.push('command -v file', 'command -v uname');
  const result = await exec(client, `set -e; ${requirements.join(' && ')}`);
  if (result.code !== 0) {
    throw new Error(`remote preflight failed: ${result.stderr || result.stdout || 'router prerequisites are not satisfied'}`.trim());
  }
}
