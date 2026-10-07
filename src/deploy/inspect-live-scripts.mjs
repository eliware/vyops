import { readFile } from "node:fs/promises";
import { log } from "@eliware/common";
import { exec } from "../ssh/exec.mjs";
import { readManagedPaths, unmanagedPaths } from "./script-manifest.mjs";

export async function inspectLiveScripts(client, config) {
  const manifest = `${config}.manifest.tsv`;
  try {
    const managed = await readManagedPaths(readFile, manifest);
    const live = await exec(client, "find -P /config/scripts -type f -print0 2>/dev/null");
    if (live.code !== 0)
      throw new Error(live.stderr || live.stdout || "live script inspection failed");
    const unmanaged = unmanagedPaths(live.stdout, managed);
    if (unmanaged.length)
      log.warn(
        `live router has unmanaged script files (${unmanaged.join(", ")}); run a fresh backup before relying on rollback`,
      );
    return managed;
  } catch (error) {
    if (error.code !== "ENOENT") throw new Error(`live script inspection failed: ${error.message}`);
    return new Set();
  }
}
