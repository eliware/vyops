import { prepareDeployment } from "./prepare.mjs";
import { completeDeployment } from "./complete.mjs";
import { cleanupRemoteStaging } from "./remote-staging-cleanup.mjs";
import { recoverRun } from "./recover-run.mjs";
import { runReleaseCommands } from "./release-commands.mjs";
import { createDeploymentState } from "./deployment-state.mjs";

export async function runDeployment(options) {
  const state = options;
  let finalizeHooks;
  const deploymentState = createDeploymentState();
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
        deploymentState.markDeploymentCommitted();
      },
    );
    state.debugLog(`interactive sequence returned (${result.output.length} bytes)`);
    if (result.compare) state.log.info(state.redact(result.compare));
    await completeDeployment({
      ...state,
      manifest: state.remotePaths.manifest,
      finalizeHooks,
      setHooksFinalized: () => {
        deploymentState.markHooksFinalized();
      },
    });
    return 0;
  } catch (error) {
    await recoverRun(state, { error, ...deploymentState.recovery(finalizeHooks) });
    throw error;
  } finally {
    state.unregisterCleanup();
    await cleanupRemoteStaging({ ...state, client: state.client });
  }
}
