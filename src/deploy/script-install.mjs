import { exec } from "../ssh/exec.mjs";
import { writeInstalledScriptManifest } from "./script-manifest-write.mjs";

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
    await writeInstalledScriptManifest({ client, name, installed, manifest, redact });
    debugLog(`installed script: ${name}`);
  }
}
