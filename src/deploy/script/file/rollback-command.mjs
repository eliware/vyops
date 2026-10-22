export function fileRollbackCommands({ manifest, installDir, backupDir, remoteDir }) {
  const files = `${remoteDir}/rollback-files.tsv`;
  return [
    `sudo awk -F '\\t' '$1 == "file" && $3 == "false" {print $2}' ${JSON.stringify(manifest)} > ${JSON.stringify(files)} || exit 1`,
    `while IFS= read -r name`,
    "do",
    '  [ -n "$name" ] || continue',
    '  safe_name "$name" || exit 1',
    `  sudo rm -f -- ${JSON.stringify(installDir)}/"$name" || exit 1`,
    `done < ${JSON.stringify(files)} || exit 1`,
    `sudo cp -a ${JSON.stringify(`${backupDir}/.`)} ${JSON.stringify(`${installDir}/`)} 2>/dev/null || exit 1`,
  ];
}
