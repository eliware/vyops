import { rollbackScripts } from "./script-rollback.mjs";

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
