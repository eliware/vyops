import { readAndValidateConfig } from "../validate.mjs";
import { validateBundle, validateScriptManifest } from "../bundle.mjs";

export async function runPreflight(args, log) {
  log.debug(`[vyops] preflight: reading config ${args.config}`);
  const text = await readAndValidateConfig(args.config);
  log.debug("[vyops] preflight: config validation complete");
  log.debug("[vyops] preflight: validating scripts and target");
  const { target, scripts } = await validateBundle(args.config, text);
  log.debug(`[vyops] preflight: found ${scripts.length} script files`);
  await validateScriptManifest(args.config);
  log.debug("[vyops] preflight: script manifest validation complete");
  log.info(`Preflight successful: ${target} (${scripts.length} script files)`);
  return { target, scripts };
}
