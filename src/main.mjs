import { parseArgs, usage } from './args.mjs';
import packageJson from '../package.json' with { type: 'json' };
import { deploy } from './deploy.mjs';
import { readAndValidateConfig } from './validate.mjs';
import { pushBack, shouldSkip } from './git.mjs';

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage);
    process.exit(0);
  }
  if (args.version) {
    console.log(packageJson.version);
    process.exit(0);
  }
  await readAndValidateConfig(args.config);
  if (args.dryRun) {
    console.log(`Configuration valid; dry run for ${args.target}`);
    process.exit(0);
  }
  if (await shouldSkip(args.config)) {
    console.log('Latest commit is Pushback and config is unchanged; skipping deployment');
    process.exit(0);
  }
  await deploy(args);
  if (await pushBack(args.config)) console.log('Pushback committed and pushed');
  console.log('Deployment successful');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
