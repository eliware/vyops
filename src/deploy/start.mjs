import { randomUUID } from "node:crypto";
import { createDeploymentLogger } from "./logger.mjs";
import { deploymentRemotePaths } from "./remote-paths.mjs";
import { registerDeploymentCleanup } from "./cleanup.mjs";
import { createInterruptionCleanup } from "./remote-interruption-cleanup.mjs";

export async function startDeployment(options) {
  const { target, password, operationId, connect, close, exec, log, getClient, setClient } =
    options;
  const logger = createDeploymentLogger(log, operationId, password, getClient);
  logger.phase("connect");
  logger.debugLog(`connecting: ${target}`);
  const connectClient = async () => {
    const client =
      password === undefined ? await connect(target) : await connect(target, { password });
    client.__vyopsDeploymentId = operationId;
    client.__vyopsPhase = "connect";
    return client;
  };
  const client = await connectClient();
  try {
    setClient(client);
    logger.debugLog("SSH connected");
    const runId = randomUUID();
    const remotePaths = deploymentRemotePaths(runId);
    const cleanup = createInterruptionCleanup({
      close,
      connectClient,
      exec,
      remotePaths,
      target,
      log,
      getClient,
    });
    const unregisterCleanup = registerDeploymentCleanup(cleanup);
    return { ...logger, connectClient, runId, remotePaths, unregisterCleanup };
  } catch (error) {
    try {
      await close(client);
    } catch (closeError) {
      log.warn(`VyOps cleanup warning: SSH close failed after setup error: ${closeError.message}`);
    }
    throw error;
  }
}
