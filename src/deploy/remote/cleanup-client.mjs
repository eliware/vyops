export async function getCleanupClient(client, connectClient, close, log) {
  let cleanupClient = client;
  if (cleanupClient?.state && cleanupClient.state !== "open") {
    const closedClient = cleanupClient;
    cleanupClient = null;
    try {
      await close(closedClient);
    } catch (error) {
      log.warn(`VyOps cleanup warning: closed SSH client close failed: ${error.message}`);
    }
  }
  return cleanupClient || connectClient();
}

export async function closeCleanupClient(client, close) {
  if (!client) return undefined;
  try {
    await close(client);
  } catch (error) {
    return error;
  }
}
