import { removeRemoteStaging } from "./remove-staging.mjs";

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
      await removeRemoteStaging(exec, recoveryClient, remotePaths);
    } catch (error) {
      log.warn(
        `VyOps cleanup warning: interruption cleanup failed for ${target}: ${error.message}`,
      );
    } finally {
      await close(recoveryClient);
    }
  };
}
