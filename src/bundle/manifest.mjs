import { readFile as defaultReadFile } from "node:fs/promises";
import { isSafeScriptPath } from "./script/path-rules.mjs";
import { bundleManifestHeader, bundleManifestHeaderWithPreexisting } from "../manifest/columns.mjs";

export async function validateScriptManifest(config, readFile = defaultReadFile, availablePaths) {
  const manifestPath = `${config}.manifest.tsv`;
  let content;
  try {
    content = await readFile(manifestPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
  const lines = content.split(/\r?\n/);
  const header = lines.shift();
  if (header !== bundleManifestHeader && header !== bundleManifestHeaderWithPreexisting)
    throw new Error("preflight failed: deployment manifest has an invalid header");
  const hasPreexistingColumn = header === bundleManifestHeaderWithPreexisting;
  const names = new Set();
  for (const line of lines) {
    if (!line) continue;
    const [kind, name, ...fields] = line.split("\t");
    const validFields = hasPreexistingColumn
      ? fields.length === 1 && ["true", "false"].includes(fields[0])
      : fields.length === 0;
    if (kind !== "file" || !name || !validFields)
      throw new Error("preflight failed: deployment manifest contains a malformed record");
    if (names.has(name))
      throw new Error("preflight failed: deployment manifest contains a duplicate script path");
    names.add(name);
  }
  if ([...names].some((name) => !isSafeScriptPath(name))) {
    throw new Error("preflight failed: deployment manifest contains an unsafe script path");
  }
  const available = availablePaths && new Set(availablePaths);
  if (available && [...names].some((name) => !available.has(name)))
    throw new Error("preflight failed: deployment manifest names a missing script file");
  return new Set(names);
}
