import { verifyRelease } from "./verify-release.mjs";
import { promises as fs } from "node:fs";
import { downloadFilesToReplace } from "./download-to-replace.mjs";
import { deploymentManifestPath } from "./deployment-manifest-path.mjs";

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
  const files = [{ remote: "/config/config.boot", local: config }];
  if (finalizeHooks) {
    phase("download deployment manifest");
    files.push({ remote: manifest, local: deploymentManifestPath(config) });
  }
  await downloadFilesToReplace(fs, download, getClient(), files);
  if (verify) await verifyRelease(getClient(), exec, log, redact);
  phase("run hooks");
  if (finalizeHooks) {
    setHooksFinalized();
    await finalizeHooks(true, getClient());
  }
}
