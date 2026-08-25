import { parseArgs, usage } from './args.mjs';
import packageJson from '../package.json' with { type: 'json' };
import { deploy } from './deploy.mjs';
import { backup } from './backup.mjs';
import { readAndValidateConfig } from './validate.mjs';
import { validateBundle, targetFromConfig } from './bundle.mjs';
import { pushBack, shouldSkip } from './git.mjs';
import { closeAll } from './ssh.mjs';
import { log, registerHandlers, registerSignals } from '@eliware/common';

async function readPasswordStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

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
    args.password = await readPasswordStdin();
    if (!args.password) throw new Error('password-stdin received an empty password');
  }
  if (args.command === 'backup') {
    await backup(args);
    log.info(`Backup successful: ${args.config}`);
    process.exit(0);
  }
  if (args.command === 'preflight') {
    const text = await readAndValidateConfig(args.config);
    const { target, scripts } = await validateBundle(args.config, text);
    log.info(`Preflight successful: ${target} (${scripts.length} script files)`);
    process.exit(0);
  }
  if (args.command === 'release') {
    const text = await readAndValidateConfig(args.config);
    await validateBundle(args.config, text);
    args.target = targetFromConfig(text);
  }
  log.debug(`[vyops] validating config: ${args.config}`);
  const configText = await readAndValidateConfig(args.config);
  if (args.command === 'release') await validateBundle(args.config, configText, { extractTarget: true });
  log.debug('[vyops] config validation complete');
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
