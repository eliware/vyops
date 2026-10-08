import { exec } from "../ssh/exec.mjs";

export async function installStagedScripts(options) {
  const { staged, client, backupDir, installDir, runId, manifest, redact, debugLog } = options;
  for (const { name, remote, installed, parent, mode, executable, binary, managed } of staged) {
    const temporary = `${installed}.vyops-${runId}`;
    const ownership = managed
      ? ` && sudo chown --reference=${JSON.stringify(`${backupDir}/${name}`)} ${JSON.stringify(temporary)}`
      : ` && sudo chown root:root ${JSON.stringify(temporary)}`;
    const remoteChecks = ` && sudo test -f ${JSON.stringify(installed)} && sudo test ! -L ${JSON.stringify(installed)} && test "$(sudo realpath -- ${JSON.stringify(installed)})" = ${JSON.stringify(installed)}${
      executable ? ` && sudo test -x ${JSON.stringify(installed)}` : ""
    }`;
    const lineEndingCheck = binary
      ? ""
      : ` && ! sudo grep -q "$(printf '\\r')" ${JSON.stringify(installed)}`;
    const destinationCheck = `if sudo test -L ${JSON.stringify(installed)}; then exit 1; elif sudo test -e ${JSON.stringify(installed)}; then sudo test -f ${JSON.stringify(installed)} && test "$(sudo realpath -- ${JSON.stringify(installed)})" = ${JSON.stringify(installed)}; fi`;
    const installedResult = await exec(
      client,
      `sudo mkdir -p ${JSON.stringify(`${installDir}/${parent}`)} && sudo rm -f -- ${JSON.stringify(temporary)} && sudo install -m ${mode.toString(8)} ${JSON.stringify(remote)} ${JSON.stringify(temporary)}${ownership} && sudo chmod ${mode.toString(8)} ${JSON.stringify(temporary)} && sudo test -f ${JSON.stringify(temporary)} && sudo test ! -L ${JSON.stringify(temporary)} && test "$(sudo realpath -- ${JSON.stringify(temporary)})" = ${JSON.stringify(temporary)}${executable ? ` && sudo test -x ${JSON.stringify(temporary)}` : ""}${lineEndingCheck.replaceAll(JSON.stringify(installed), JSON.stringify(temporary))} && ${destinationCheck} && sudo mv -f -- ${JSON.stringify(temporary)} ${JSON.stringify(installed)}${remoteChecks} || { sudo rm -f -- ${JSON.stringify(temporary)}; exit 1; }`,
    );
    if (installedResult.code !== 0)
      throw new Error(
        `script install failed (${name}): ${redact(installedResult.stderr || installedResult.stdout)}`.trim(),
      );
    const manifestResult = await exec(
      client,
      `file_mode=$(sudo stat -c %a ${JSON.stringify(installed)}) && file_hash_output=$(sudo sha256sum ${JSON.stringify(installed)}) && file_hash=\${file_hash_output%% *} && file_type=$(sudo stat -c %F ${JSON.stringify(installed)}) && test -n "$file_mode" && test -n "$file_hash" && test -n "$file_type" && printf 'file\\t%s\\t-\\t-\\t-\\t-\\t%s\\t%s\\t%s\\n' ${JSON.stringify(name)} "$file_mode" "$file_hash" "$file_type" >> ${JSON.stringify(manifest)}`,
    );
    if (manifestResult.code !== 0)
      throw new Error(
        `manifest update failed (${name}): ${redact(manifestResult.stderr || manifestResult.stdout)}`.trim(),
      );
    debugLog(`installed script: ${name}`);
  }
}
