import { rollbackScripts } from "./rollback.mjs";

export async function finalizeScripts(exec, log, paths) {
  if (paths.committed) {
    try {
      const result = await exec(
        paths.client,
        `rm -rf -- ${JSON.stringify(paths.remoteDir)} && sudo rm -rf -- ${JSON.stringify(paths.backupDir)}`,
      );
      if (result.code === 0) return true;
      log.warn(
        `VyOps cleanup warning: post-commit script cleanup failed. Backup remains at ${paths.backupDir}. ${result.stderr || result.stdout}`,
      );
    } catch (error) {
      log.warn(
        `VyOps cleanup warning: post-commit script cleanup failed. Backup remains at ${paths.backupDir}. ${error.message}`,
      );
    }
    return false;
  }
  return rollbackScripts(exec, log, paths);
}
