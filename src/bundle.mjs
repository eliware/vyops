import { promises as fs } from "node:fs";
import { join } from "node:path";
import { targetFromConfig } from "./bundle/target.mjs";
import { validateScriptManifest } from "./bundle/manifest.mjs";
import { isSafeScriptPath, validateScriptPath } from "./bundle/script/path-rules.mjs";
import { filesIn } from "./bundle/script/tree.mjs";
import { validateScriptFile } from "./bundle/script/validation.mjs";

export { targetFromConfig, isSafeScriptPath, validateScriptManifest };

/* SPLIT_TARGET_START */
export async function validateBundle(config, text, { extractTarget = true, fsApi = fs } = {}) {
  const scripts = await filesIn(join(config, "..", "scripts"), fsApi);
  for (const { file, name } of scripts) {
    validateScriptPath(name);
    await validateScriptFile(fsApi, { file, name });
  }
  return { ...(extractTarget ? { target: targetFromConfig(text) } : {}), scripts };
}
