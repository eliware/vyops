import { parseArgs, usage } from './args.mjs';
import packageJson from '../package.json' with { type: 'json' };
import { cleanupActiveDeployments, deploy } from './deploy.mjs';
import { readAndValidateConfig } from './validate.mjs';
import { runBackup } from './commands/backup.mjs';
import { runPreflight } from './commands/preflight.mjs';
import { prepareRelease } from './commands/release.mjs';
import { pushBack, repositorySnapshot, shouldSkip } from './git.mjs';
import { closeAll } from './ssh.mjs';
import { log, registerHandlers, registerSignals } from '@eliware/common';
import { randomUUID } from 'node:crypto';

async function readPasswordStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

const errors = registerHandlers({ log });
const signals = registerSignals({ log, shutdownHook: async () => { await closeAll(); await cleanupActiveDeployments(); } });

try {
  const args = parseArgs(process.argv.slice(2));
  args.operationId = randomUUID();
  log.debug(`[vyops] [deployment ${args.operationId}] arguments parsed: target=${args.target || '-'} config=${args.config || '-'}`);
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
    await runBackup(args, log);
    process.exit(0);
  }
  if (args.command === 'preflight') {
    await runPreflight(args, log);
    process.exit(0);
  }
  if (args.command === 'release') {
    const text = await readAndValidateConfig(args.config);
    await prepareRelease(args, text, log);
  }
  log.debug(`[vyops] [deployment ${args.operationId}] validating config: ${args.config}`);
  if (args.command !== 'release') await readAndValidateConfig(args.config);
  log.debug(`[vyops] [deployment ${args.operationId}] config validation complete`);
  if (!args.force && !args.noPushback && await shouldSkip(args.config)) {
    log.info(`[deployment ${args.operationId}] Latest commit is Pushback and config is unchanged; skipping deployment`);
    process.exit(0);
  }
  log.debug(`[vyops] [deployment ${args.operationId}] phase: release / connect`);
  log.debug(`[vyops] [deployment ${args.operationId || 'preflight'}] deployment starting`);
  const expectedRepository = !args.noPushback ? await repositorySnapshot(args.config) : null;
  await deploy(args);
  log.debug(`[vyops] [deployment ${args.operationId}] phase: pushback`);
  log.debug(`[vyops] [deployment ${args.operationId}] deployment complete; starting Git pushback`);
  if (!args.noPushback && await pushBack(args.config, { force: args.force, expectedState: expectedRepository })) log.info(`[deployment ${args.operationId}] Pushback committed and pushed`);
  log.info(`[deployment ${args.operationId}] Deployment successful`);
} catch (error) {
  log.error(error.message);
  process.exitCode = 1;
} finally {
  signals.removeHandlers();
  errors.removeHandlers();
}
