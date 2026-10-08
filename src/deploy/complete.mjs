import { verifyRelease } from "./verify-release.mjs";
import { promises as fs } from "node:fs";
import { downloadToReplace } from "./download-to-replace.mjs";

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
  await downloadToReplace(fs, download, getClient(), "/config/config.boot", config);
  if (finalizeHooks) {
    phase("download deployment manifest");
    await downloadToReplace(fs, download, getClient(), manifest, `${config}.manifest.tsv`);
  }
  if (verify) await verifyRelease(getClient(), exec, log, redact);
  phase("run hooks");
  if (finalizeHooks) {
    setHooksFinalized();
    await finalizeHooks(true, getClient());
  }
}
