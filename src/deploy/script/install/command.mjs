export function buildScriptInstallCommand(stagedScript, { backupDir, installDir, runId }) {
  const { name, remote, installed, parent, mode, executable, binary, managed } = stagedScript;
  const temporary = `${installed}.vyops-${runId}`;
  const temporaryPath = JSON.stringify(temporary);
  const installedPath = JSON.stringify(installed);
  const ownership = managed
    ? `sudo chown --reference=${JSON.stringify(`${backupDir}/${name}`)} ${temporaryPath}`
    : `sudo chown root:root ${temporaryPath}`;
  const commands = [
    `sudo mkdir -p ${JSON.stringify(`${installDir}/${parent}`)}`,
    `sudo rm -f -- ${temporaryPath}`,
    `sudo install -m ${mode.toString(8)} ${JSON.stringify(remote)} ${temporaryPath}`,
    ownership,
    `sudo chmod ${mode.toString(8)} ${temporaryPath}`,
    `sudo test -f ${temporaryPath}`,
    `sudo test ! -L ${temporaryPath}`,
    `test "$(sudo realpath -- ${temporaryPath})" = ${temporaryPath}`,
  ];
  if (executable) commands.push(`sudo test -x ${temporaryPath}`);
  if (!binary) commands.push(`! sudo grep -q "$(printf '\\r')" ${temporaryPath}`);
  const destinationCheck = [
    `if sudo test -L ${installedPath}`,
    "then exit 1",
    `elif sudo test -e ${installedPath}`,
    "then",
    `  sudo test -f ${installedPath} && test "$(sudo realpath -- ${installedPath})" = ${installedPath}`,
    "fi",
  ].join("\n");
  commands.push(destinationCheck);
  commands.push(`sudo mv -f -- ${temporaryPath} ${installedPath}`);
  return [
    `if ${commands.join(" &&\n")}`,
    "then",
    "  :",
    "else",
    `  sudo rm -f -- ${temporaryPath}`,
    "  exit 1",
    "fi",
  ].join("\n");
}
