import { readAndValidateConfig } from '../validate.mjs';
import { validateBundle } from '../bundle.mjs';

export async function runPreflight(args, log) {
  const text = await readAndValidateConfig(args.config);
  const { target, scripts } = await validateBundle(args.config, text);
  log.info(`Preflight successful: ${target} (${scripts.length} script files)`);
}
