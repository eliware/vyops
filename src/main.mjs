import { parseArgs, usage } from './args.mjs';
import packageJson from '../package.json' with { type: 'json' };
import { deploy } from './deploy.mjs';
import { readAndValidateConfig } from './validate.mjs';
import { pushBack, shouldSkip } from './git.mjs';
import { closeAll } from './ssh.mjs';
import { log, registerHandlers, registerSignals } from '@eliware/common';

const errors = registerHandlers({ log });
const signals = registerSignals({ log, shutdownHook: async () => closeAll() });

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    log.info(usage);
    process.exit(0);
  }
  if (args.version) {
    log.info(packageJson.version);
    process.exit(0);
  }
  await readAndValidateConfig(args.config);
  if (args.dryRun) {
    log.info(`Configuration valid; dry run for ${args.target}`);
    process.exit(0);
  }
  if (await shouldSkip(args.config)) {
    log.info('Latest commit is Pushback and config is unchanged; skipping deployment');
    process.exit(0);
  }
  await deploy(args);
  if (await pushBack(args.config)) log.info('Pushback committed and pushed');
  log.info('Deployment successful');
} catch (error) {
  log.error(error.message);
  process.exitCode = 1;
} finally {
  signals.removeHandlers();
  errors.removeHandlers();
}
