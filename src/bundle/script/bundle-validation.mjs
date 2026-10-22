import { promises as fs } from "node:fs";
import { join } from "node:path";
import { validateScriptPath } from "./path-rules.mjs";
import { filesIn } from "./tree.mjs";
import { validateScriptFile } from "./validation.mjs";

export async function validateBundleScripts(config, fsApi = fs) {
  const scripts = await filesIn(join(config, "..", "scripts"), fsApi);
  for (const { file, name } of scripts) {
    validateScriptPath(name);
    await validateScriptFile(fsApi, { file, name });
  }
  return scripts;
}
