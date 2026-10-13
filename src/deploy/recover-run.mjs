import { recoverDeployment } from "./recover.mjs";

export async function recoverRun(state, options) {
  const { error, finalizeHooks, hooksFinalized, deploymentCommitted } = options;
  try {
    state.client = await recoverDeployment({
      error,
      target: state.target,
      client: state.client,
      close: state.close,
      connectClient: state.connectClient,
      debugLog: state.debugLog,
      finalizeHooks,
      hooksFinalized,
      deploymentCommitted,
    });
  } catch (recoveryError) {
    state.debugLog(`recovery failed: ${recoveryError.message}`);
    state.client = null;
  }
  state.setClient(state.client);
}
