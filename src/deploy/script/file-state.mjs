export function scriptFileState({ name, parent, backupDir, backup, installed, manifest }) {
  const path = JSON.stringify(installed);
  const backupPath = JSON.stringify(backup);
  const manifestPath = JSON.stringify(manifest);
  const fileName = JSON.stringify(name);
  const existingRecord = [
    `sudo mkdir -p ${JSON.stringify(`${backupDir}/${parent}`)}`,
    `sudo cp -p -- ${path} ${backupPath}`,
    `file_mode=$(sudo stat -c %a ${path})`,
    `file_hash=$(sudo sha256sum ${path} | awk '{print $1}')`,
    `file_type=$(sudo stat -c %F ${path})`,
    `printf 'file\\t%s\\ttrue\\t%s\\t%s\\t%s\\t-\\t-\\t-\\n' ${fileName} "$file_mode" "$file_hash" "$file_type" >> ${manifestPath}`,
  ].join(" &&\n");
  return [
    `if sudo test -L ${path}`,
    "then",
    "  echo 'destination is a symlink' >&2",
    "  exit 1",
    `elif sudo test -e ${path}`,
    "then",
    `  sudo test -f ${path} && test "$(sudo realpath -- ${path})" = ${path} && ${existingRecord}`,
    "else",
    `  printf 'file\\t%s\\tfalse\\t-\\t-\\t-\\t-\\t-\\t-\\n' ${fileName} >> ${manifestPath}`,
    "fi",
  ].join("\n");
}
