export async function recoverDeployment(options) {
  const {
    error,
    target,
    client,
    close,
    connectClient,
    debugLog,
    finalizeHooks,
    hooksFinalized,
    deploymentCommitted,
  } = options;
  debugLog(
    `${error.code === "VYOPS_TIMEOUT" ? "timeout" : "transport"} recovery: discarding SSH client for ${target}`,
  );
  await close(client);
  let recoveryClient;
  try {
    debugLog(`recovery: reconnecting SSH client for ${target}`);
    recoveryClient = await connectClient();
  } catch (reconnectError) {
    debugLog(`recovery reconnect failed: ${reconnectError.message}`);
  }
  if (finalizeHooks && !hooksFinalized) {
    let cleanupClient = recoveryClient;
    if (!cleanupClient) cleanupClient = await connectClient();
    await finalizeHooks(deploymentCommitted, cleanupClient);
    if (cleanupClient && cleanupClient !== recoveryClient) await close(cleanupClient);
  }
  return recoveryClient;
}
