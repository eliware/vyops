export function buildScriptInstallCommand(stagedScript, { backupDir, installDir, runId }) {
  const { name, remote, installed, parent, mode, executable, binary, managed } = stagedScript;
  const temporary = `${installed}.vyops-${runId}`;
  const ownership = managed
    ? ` && sudo chown --reference=${JSON.stringify(`${backupDir}/${name}`)} ${JSON.stringify(temporary)}`
    : ` && sudo chown root:root ${JSON.stringify(temporary)}`;
  const lineEndingCheck = binary
    ? ""
    : ` && ! sudo grep -q "$(printf '\\r')" ${JSON.stringify(installed)}`;
  const destinationCheck = `if sudo test -L ${JSON.stringify(installed)}; then exit 1; elif sudo test -e ${JSON.stringify(installed)}; then sudo test -f ${JSON.stringify(installed)} && test "$(sudo realpath -- ${JSON.stringify(installed)})" = ${JSON.stringify(installed)}; fi`;
  return `sudo mkdir -p ${JSON.stringify(`${installDir}/${parent}`)} && sudo rm -f -- ${JSON.stringify(temporary)} && sudo install -m ${mode.toString(8)} ${JSON.stringify(remote)} ${JSON.stringify(temporary)}${ownership} && sudo chmod ${mode.toString(8)} ${JSON.stringify(temporary)} && sudo test -f ${JSON.stringify(temporary)} && sudo test ! -L ${JSON.stringify(temporary)} && test "$(sudo realpath -- ${JSON.stringify(temporary)})" = ${JSON.stringify(temporary)}${executable ? ` && sudo test -x ${JSON.stringify(temporary)}` : ""}${lineEndingCheck.replaceAll(JSON.stringify(installed), JSON.stringify(temporary))} && ${destinationCheck} && sudo mv -f -- ${JSON.stringify(temporary)} ${JSON.stringify(installed)} || { sudo rm -f -- ${JSON.stringify(temporary)}; exit 1; }`;
}
