import { scriptRollbackCommand } from "./script-rollback-command.mjs";

export async function rollbackScripts(exec, log, paths) {
  try {
    const result = await exec(paths.client, scriptRollbackCommand(paths));
    if (result.code === 0) return true;
    log.warn(
      `VyOps cleanup warning: script rollback failed: ${result.stderr || result.stdout}; backup remains at ${paths.backupDir}`,
    );
  } catch (error) {
    log.warn(
      `VyOps cleanup warning: script rollback failed: ${error.message}; backup remains at ${paths.backupDir}`,
    );
  }
  return false;
}
