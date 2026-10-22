import { promises as fs } from "node:fs";
import { downloadFilesToReplace } from "../download/to-replace.mjs";
import { deploymentManifestPath } from "../deployment/manifest-path.mjs";

export async function downloadSynchronizedState({
  download,
  client,
  manifest,
  config,
  finalizeHooks,
  log,
}) {
  const files = [{ remote: "/config/config.boot", local: config }];
  if (finalizeHooks) files.push({ remote: manifest, local: deploymentManifestPath(config) });
  await downloadFilesToReplace(fs, download, client, files, log);
}
