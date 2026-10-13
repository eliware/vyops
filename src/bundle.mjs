import { promises as fs } from "node:fs";
import { join, relative } from "node:path";
import { targetFromConfig } from "./bundle/target.mjs";
import { validateScriptManifest } from "./bundle/manifest.mjs";
import { isSafeScriptPath, validateScriptPath } from "./bundle/script-path-rules.mjs";
import { validateScriptContent } from "./bundle/script-content-validation.mjs";

export { targetFromConfig, isSafeScriptPath, validateScriptManifest };

async function filesIn(directory, root, fsApi) {
  const result = [];
  let entries;
  try {
    entries = await fsApi.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return result;
    throw error;
  }
  for (const entry of entries) {
    const file = join(directory, entry.name);
    // Symlinks are intentionally excluded so traversal cannot escape the bundle root.
    if (entry.isDirectory()) result.push(...(await filesIn(file, root, fsApi)));
    else if (entry.isFile())
      result.push({ file, name: relative(root, file).replaceAll("\\", "/") });
  }
  return result;
}

/* SPLIT_TARGET_START */
export async function validateBundle(config, text, { extractTarget = true, fsApi = fs } = {}) {
  const scripts = await filesIn(
    join(config, "..", "scripts"),
    join(config, "..", "scripts"),
    fsApi,
  );
  for (const { file, name } of scripts) {
    validateScriptPath(name);
    const data = await fsApi.readFile(file);
    const mode = (await fsApi.stat(file)).mode & 0o777;
    validateScriptContent(name, data, mode);
  }
  return { ...(extractTarget ? { target: targetFromConfig(text) } : {}), scripts };
}
