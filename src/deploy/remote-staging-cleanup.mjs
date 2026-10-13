import { removeRemoteStaging } from "./remove-staging.mjs";

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
  let cleanupClient = client;
  let cleanupError;
  try {
    if (cleanupClient?.state && cleanupClient.state !== "open") {
      const closedClient = cleanupClient;
      cleanupClient = null;
      try {
        await close(closedClient);
      } catch (error) {
        log.warn(`VyOps cleanup warning: closed SSH client close failed: ${error.message}`);
      }
    }
    if (!cleanupClient) cleanupClient = await connectClient();
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
  if (cleanupClient) {
    try {
      await close(cleanupClient);
    } catch (error) {
      cleanupError ||= error;
      log.warn(`VyOps cleanup warning: SSH close failed after staging cleanup: ${error.message}`);
    }
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
