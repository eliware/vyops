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
    } catch (error) {
      log.warn(`VyOps cleanup warning: interrupted SSH close failed: ${error.message}`);
    }
    try {
      recoveryClient = await connectClient();
      await removeRemoteStaging(exec, recoveryClient, remotePaths);
    } catch (error) {
      log.warn(
        `VyOps cleanup warning: interruption cleanup failed for ${target}: ${error.message}`,
      );
    } finally {
      if (recoveryClient) {
        try {
          await close(recoveryClient);
        } catch (error) {
          log.warn(`VyOps cleanup warning: recovery SSH close failed: ${error.message}`);
        }
      }
    }
  };
}
