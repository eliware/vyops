export function directoryRollbackCommands({ manifest, installDir, remoteDir }) {
  const directories = `${remoteDir}/rollback-directories.tsv`;
  const sortedDirectories = `${remoteDir}/rollback-directories-sorted.tsv`;
  return [
    `sudo awk -F '\\t' '$1 == "directory" && $3 == "false" {print $2}' ${JSON.stringify(manifest)} > ${JSON.stringify(directories)} || exit 1`,
    `sort -r ${JSON.stringify(directories)} > ${JSON.stringify(sortedDirectories)} || exit 1`,
    `while IFS= read -r name`,
    "do",
    '  [ -n "$name" ] || continue',
    '  safe_name "$name" || exit 1',
    `  sudo rmdir -- ${JSON.stringify(installDir)}/"$name" 2>/dev/null || exit 1`,
    `done < ${JSON.stringify(sortedDirectories)} || exit 1`,
  ];
}
