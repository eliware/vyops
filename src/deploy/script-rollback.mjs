function cleanupCommand({ manifest, installDir, backupDir, remoteDir }) {
  return `safe_name() { case "$1" in ""|/*|*[!A-Za-z0-9._/@-]*) return 1;; esac; case "/$1/" in *"/../"*|*"/./"*|*"//"*) return 1;; esac; }; sudo awk -F '\\t' '$1 == "file" && $3 == "false" {print $2}' ${JSON.stringify(manifest)} | while IFS= read -r name; do safe_name "$name" || exit 1; sudo rm -f -- ${JSON.stringify(installDir)}/"$name"; done || exit 1; sudo cp -a ${JSON.stringify(`${backupDir}/.`)} ${JSON.stringify(`${installDir}/`)} 2>/dev/null || true; sudo awk -F '\\t' '$1 == "directory" && $3 == "false" {print $2}' ${JSON.stringify(manifest)} | sort -r | while IFS= read -r name; do safe_name "$name" || exit 1; sudo rmdir -- ${JSON.stringify(installDir)}/"$name" 2>/dev/null || true; done || exit 1; rm -rf -- ${JSON.stringify(remoteDir)} ${JSON.stringify(backupDir)}`;
}

export async function rollbackScripts(exec, log, paths) {
  await exec(paths.client, cleanupCommand(paths)).catch((error) =>
    log.warn(`VyOps cleanup warning: script rollback failed: ${error.message}`),
  );
}

export async function finalizeScripts(exec, log, paths) {
  if (paths.committed) {
    await exec(
      paths.client,
      `sudo rm -rf -- ${JSON.stringify(paths.backupDir)}; rm -rf -- ${JSON.stringify(paths.remoteDir)}`,
    ).catch((error) => log.warn(`VyOps cleanup warning: hook cleanup failed: ${error.message}`));
    return;
  }
  await rollbackScripts(exec, log, paths);
}
