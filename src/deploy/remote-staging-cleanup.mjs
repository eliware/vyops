import { removeRemoteStaging } from "./remove-staging.mjs";

export async function cleanupRemoteStaging({
  exec,
  close,
  connectClient,
  client,
  remotePaths,
  log,
  debugLog,
}) {
  debugLog("cleaning up remote file");
  let cleanupClient = client;
  try {
    if (cleanupClient?.state && cleanupClient.state !== "open") {
      await close(cleanupClient);
      cleanupClient = null;
    }
    if (!cleanupClient) cleanupClient = await connectClient();
    await removeRemoteStaging(exec, cleanupClient, remotePaths);
  } catch (error) {
    log.warn(
      `VyOps cleanup warning: remote staging cleanup could not be completed: ${error.message}`,
    );
  }
  await close(cleanupClient);
}
