import { rollbackScripts } from "./script-rollback.mjs";

export async function finalizeScripts(exec, log, paths) {
  if (paths.committed) {
    try {
      const result = await exec(
        paths.client,
        `rm -rf -- ${JSON.stringify(paths.remoteDir)} && sudo rm -rf -- ${JSON.stringify(paths.backupDir)}`,
      );
      if (result.code === 0) return true;
      log.warn(
        `VyOps cleanup warning: hook cleanup failed: ${result.stderr || result.stdout}; backup remains at ${paths.backupDir}`,
      );
    } catch (error) {
      log.warn(
        `VyOps cleanup warning: hook cleanup failed: ${error.message}; backup remains at ${paths.backupDir}`,
      );
    }
    return false;
  }
  return rollbackScripts(exec, log, paths);
}
