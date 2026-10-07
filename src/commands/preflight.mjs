import { readAndValidateConfig } from "../validate.mjs";
import { validateBundle, validateScriptManifest } from "../bundle.mjs";

export async function runPreflight(args, log) {
  const text = await readAndValidateConfig(args.config);
  const { target, scripts } = await validateBundle(args.config, text);
  await validateScriptManifest(args.config);
  log.info(`Preflight successful: ${target} (${scripts.length} script files)`);
  return { target, scripts };
}
