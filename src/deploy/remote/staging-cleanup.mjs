import { removeRemoteStaging } from "../remove-staging.mjs";
import { closeCleanupClient, getCleanupClient } from "./cleanup-client.mjs";

export async function cleanupRemoteStaging({
  exec,
  close,
  connectClient,
  client,
  remotePaths,
  log,
  debugLog,
  preserveScriptsBackup = false,
  operationError,
  operationSucceeded = false,
}) {
  debugLog("cleaning up remote file");
  let cleanupClient;
  let cleanupError;
  try {
    cleanupClient = await getCleanupClient(client, connectClient, close, log);
    await removeRemoteStaging(exec, cleanupClient, {
      ...remotePaths,
      scriptsBackup: preserveScriptsBackup ? undefined : remotePaths.scriptsBackup,
    });
  } catch (error) {
    cleanupError = error;
    log.warn(
      `VyOps cleanup warning: remote staging cleanup could not be completed: ${error.message}`,
    );
  }
  const closeError = await closeCleanupClient(cleanupClient, close);
  if (closeError) {
    cleanupError ||= closeError;
    log.warn(
      `VyOps cleanup warning: SSH close failed after staging cleanup: ${closeError.message}`,
    );
  }
  if (cleanupError) {
    const message = `remote staging cleanup failed: ${cleanupError.message}`;
    if (operationError || operationSucceeded) {
      log.warn(`VyOps cleanup warning: ${message}`);
      return;
    }
    throw new Error(message, { cause: cleanupError });
  }
}
