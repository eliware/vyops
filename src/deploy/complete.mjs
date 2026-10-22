import { verifyRelease } from "./verify-release.mjs";
import { downloadSynchronizedState } from "./local-file/synchronized-state.mjs";

export async function completeDeployment(options) {
  const {
    getClient,
    setClient,
    connectClient,
    close,
    download,
    manifest,
    config,
    finalizeHooks,
    verify,
    exec,
    log,
    redact,
    phase,
    debugLog,
    setHooksFinalized,
  } = options;
  phase("download synchronized config");
  debugLog("reconnecting after interactive deployment sequence");
  await close(getClient());
  setClient(null);
  setClient(await connectClient());
  debugLog(`syncing live config: /config/config.boot -> ${config}`);
  if (finalizeHooks) {
    phase("download deployment manifest");
  }
  await downloadSynchronizedState({
    download,
    client: getClient(),
    manifest,
    config,
    finalizeHooks,
    log,
  });
  if (verify) await verifyRelease(getClient(), exec, log, redact);
  phase("run post-commit scripts");
  if (finalizeHooks) {
    const finalized = await finalizeHooks(true, getClient());
    if (finalized === false) throw new Error("post-commit script finalization failed");
    setHooksFinalized();
  }
}
