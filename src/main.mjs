import { parseArgs } from './args.mjs';
import { deploy } from './deploy.mjs';
import { readAndValidateConfig } from './validate.mjs';
import { pushBack, shouldSkip } from './git.mjs';

try {
  const args = parseArgs(process.argv.slice(2));
  if (await shouldSkip(args.config)) {
    console.log('Latest commit is Pushback and config is unchanged; skipping deployment');
    process.exit(0);
  }
  await readAndValidateConfig(args.config);
  await deploy(args);
  if (await pushBack(args.config)) console.log('Pushback committed and pushed');
  console.log('Deployment successful');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
