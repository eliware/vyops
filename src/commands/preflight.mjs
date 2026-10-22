import { readConfigFile } from "../validate/config-file.mjs";
import { validateConfig } from "../validate/config.mjs";
import { validateBundle, validateScriptManifest } from "../bundle.mjs";
import { readDeploymentState } from "../deploy/script/manifest.mjs";
import { readFile } from "node:fs/promises";

export async function runPreflight(args, log) {
  log.debug(`[vyops] preflight: reading config ${args.config}`);
  const text = await readConfigFile(args.config);
  validateConfig(text);
  log.debug("[vyops] preflight: config validation complete");
  log.debug("[vyops] preflight: validating scripts and target");
  const { target, scripts } = await validateBundle(args.config, text);
  log.debug(`[vyops] preflight: found ${scripts.length} script files`);
  await validateScriptManifest(
    args.config,
    undefined,
    scripts.map(({ name }) => name),
  );
  log.debug("[vyops] preflight: script manifest validation complete");
  try {
    await readDeploymentState(readFile, `${args.config}.deployment.tsv`);
  } catch (error) {
    throw new Error(`preflight failed: ${error.message}`, { cause: error });
  }
  log.debug("[vyops] preflight: deployment state validation complete");
  log.info(`Preflight complete: ${target} (${scripts.length} script files)`);
  return { target, scripts };
}
