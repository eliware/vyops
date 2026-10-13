import { scriptRollbackCommand } from "./script-rollback-command.mjs";

export async function rollbackScripts(exec, log, paths) {
  await exec(paths.client, scriptRollbackCommand(paths)).catch((error) =>
    log.warn(`VyOps cleanup warning: script rollback failed: ${error.message}`),
  );
}
