import { scriptRollbackCommand } from "./rollback-command.mjs";

export async function rollbackScripts(exec, log, paths) {
  try {
    const result = await exec(paths.client, scriptRollbackCommand(paths));
    if (result.code === 0) return true;
    log.warn(
      `VyOps cleanup warning: script restoration failed. Backup remains at ${paths.backupDir}. ${result.stderr || result.stdout}`,
    );
  } catch (error) {
    log.warn(
      `VyOps cleanup warning: script restoration failed. Backup remains at ${paths.backupDir}. ${error.message}`,
    );
  }
  return false;
}
