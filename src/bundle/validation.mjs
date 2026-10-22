import { promises as fs } from "node:fs";
import { join } from "node:path";
import { validateScriptPath } from "./script/path-rules.mjs";
import { filesIn } from "./script/tree.mjs";
import { validateScriptFile } from "./script/validation.mjs";

export async function validateBundleScripts(config, fsApi = fs) {
  const scripts = await filesIn(join(config, "..", "scripts"), fsApi);
  for (const { file, name } of scripts) {
    validateScriptPath(name);
    await validateScriptFile(fsApi, { file, name });
  }
  return scripts;
}
