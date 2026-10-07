function removeStaging(exec, client, paths) {
  const command = `rm -f -- ${JSON.stringify(paths.config)}; rm -rf -- ${JSON.stringify(paths.scripts)} ${JSON.stringify(paths.scriptsBackup)}`;
  return exec(client, command);
}

export function createInterruptionCleanup({
  close,
  connectClient,
  exec,
  remotePaths,
  target,
  log,
  getClient,
}) {
  return async () => {
    const interruptedClient = getClient();
    let recoveryClient;
    try {
      await close(interruptedClient);
      recoveryClient = await connectClient();
      await removeStaging(exec, recoveryClient, remotePaths);
    } catch (error) {
      log.warn(
        `VyOps cleanup warning: interruption cleanup failed for ${target}: ${error.message}`,
      );
    } finally {
      await close(recoveryClient);
    }
  };
}

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
    if (!cleanupClient) cleanupClient = await connectClient();
    await removeStaging(exec, cleanupClient, remotePaths);
  } catch (error) {
    log.warn(
      `VyOps cleanup warning: remote staging cleanup could not be completed: ${error.message}`,
    );
  }
  await close(cleanupClient);
}
