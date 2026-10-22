import { targetFromConfig } from "./bundle/target.mjs";
import { validateScriptManifest } from "./bundle/manifest.mjs";
import { isSafeScriptPath } from "./bundle/script/path-rules.mjs";
import { validateBundleScripts } from "./bundle/script/bundle-validation.mjs";

export { targetFromConfig, isSafeScriptPath, validateScriptManifest };

export async function validateBundle(config, text, { extractTarget = true, fsApi } = {}) {
  const scripts = await validateBundleScripts(config, fsApi);
  return { ...(extractTarget ? { target: targetFromConfig(text) } : {}), scripts };
}
