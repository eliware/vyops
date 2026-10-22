import { promises as fs } from "node:fs";
import { join } from "node:path";
import { targetFromConfig } from "./bundle/target.mjs";
import { validateScriptManifest } from "./bundle/manifest.mjs";
import { isSafeScriptPath, validateScriptPath } from "./bundle/script/path-rules.mjs";
import { validateScriptContent } from "./bundle/script/content-validation.mjs";
import { filesIn } from "./bundle/script/tree.mjs";

export { targetFromConfig, isSafeScriptPath, validateScriptManifest };

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
