import { prepareDeployment } from "./prepare.mjs";
import { completeDeployment } from "./complete.mjs";
import { cleanupRemoteStaging } from "./remote-cleanup.mjs";
import { recoverDeployment } from "./recover.mjs";
import { runReleaseCommands } from "./release-commands.mjs";

export async function runDeployment(options) {
  const state = options;
  let finalizeHooks;
  let hooksFinalized = false;
  let deploymentCommitted = false;
  const remote = state.remotePaths.config;
  try {
    finalizeHooks = await prepareDeployment({ ...state, remote });
    state.phase("connect");
    state.debugLog("reconnecting before interactive deployment sequence");
    await state.close(state.client);
    state.client = await state.connectClient();
    state.setClient(state.client);
    state.debugLog("starting interactive deployment sequence");
    const result = await runReleaseCommands(
      state.interactive,
      state.client,
      remote,
      state.debugLog,
      () => {
        deploymentCommitted = true;
      },
    );
    state.debugLog(`interactive sequence returned (${result.output.length} bytes)`);
    if (result.compare) state.log.info(state.redact(result.compare));
    await completeDeployment({
      ...state,
      manifest: state.remotePaths.manifest,
      finalizeHooks,
      setHooksFinalized: () => {
        hooksFinalized = true;
      },
    });
    return 0;
  } catch (error) {
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
    state.setClient(state.client);
    throw error;
  } finally {
    state.unregisterCleanup();
    await cleanupRemoteStaging({ ...state, client: state.client });
  }
}
