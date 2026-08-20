import { parseArgs, usage } from './args.mjs';
import packageJson from '../package.json' with { type: 'json' };
import { deploy } from './deploy.mjs';
import { backup } from './backup.mjs';
import { readAndValidateConfig } from './validate.mjs';
import { pushBack, shouldSkip } from './git.mjs';
import { closeAll } from './ssh.mjs';
import { log, registerHandlers, registerSignals } from '@eliware/common';
import { readFile } from 'node:fs/promises';

const errors = registerHandlers({ log });
const signals = registerSignals({ log, shutdownHook: async () => closeAll() });

try {
  const args = parseArgs(process.argv.slice(2));
  log.debug(`[vyops] arguments parsed: target=${args.target || '-'} config=${args.config || '-'}`);
  if (args.help) {
    log.info(usage);
    process.exit(0);
  }
  if (args.version) {
    log.info(packageJson.version);
    process.exit(0);
  }
  if (args.passwordStdin) {
    args.password = (await readFile(0, 'utf8')).replace(/\r?\n$/, '');
    if (!args.password) throw new Error('password-stdin received an empty password');
  }
  if (args.backup) {
    await backup(args);
    log.info(`Backup successful: ${args.config}`);
    process.exit(0);
  }
  log.debug(`[vyops] validating config: ${args.config}`);
  await readAndValidateConfig(args.config);
  log.debug('[vyops] config validation complete');
  if (args.dryRun) {
    log.info(`Configuration valid; dry run for ${args.target}`);
    process.exit(0);
  }
  if (!args.force && await shouldSkip(args.config)) {
    log.info('Latest commit is Pushback and config is unchanged; skipping deployment');
    process.exit(0);
  }
  log.debug('[vyops] deployment starting');
  await deploy(args);
  log.debug('[vyops] deployment complete; starting Git pushback');
  if (await pushBack(args.config, { force: args.force })) log.info('Pushback committed and pushed');
  log.info('Deployment successful');
} catch (error) {
  log.error(error.message);
  process.exitCode = 1;
} finally {
  signals.removeHandlers();
  errors.removeHandlers();
}
