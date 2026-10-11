import { readFile } from "node:fs/promises";
import { log } from "@eliware/common";
import { exec } from "../ssh/exec.mjs";
import { readDeploymentState, unmanagedPaths } from "./script-manifest.mjs";
import { deploymentManifestPath } from "./deployment-manifest-path.mjs";

export async function inspectLiveScripts(client, config, bundleNames = []) {
  const manifest = deploymentManifestPath(config);
  try {
    const state = await readDeploymentState(readFile, manifest);
    const live = await exec(client, "find -P /config/scripts -type f -print0 2>/dev/null");
    if (live.code !== 0)
      throw new Error(live.stderr || live.stdout || "live script inspection failed");
    const livePaths = unmanagedPaths(live.stdout, new Set());
    const unmanaged = livePaths.filter((file) => !state.managed.has(file));
    if (livePaths.length) {
      const bundle = new Set(bundleNames);
      const matching = livePaths.filter((file) => bundle.has(file));
      const routerOnly = livePaths.filter((file) => !bundle.has(file));
      const baseline = state.hasManifest ? "" : "No prior deployment manifest exists. ";
      const review = `${baseline}Live script review: VyOps will save matching files for rollback (${matching.join(", ") || "none"}). Router-only files will remain unchanged (${routerOnly.join(", ") || "none"}).`;
      if (unmanaged.length)
        log.warn(
          `${review} Run vyops backup <target> <directory> before release for a full backup.`,
        );
      else log.info(review);
    }
    return state.managed;
  } catch (error) {
    if (error.code !== "ENOENT") throw new Error(`live script inspection failed: ${error.message}`);
    return new Set();
  }
}
