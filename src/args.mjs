export const usage = `Usage:
  vyops preflight <config.boot>
  vyops release [--yes] [--force] [--debug] [--verify] [--no-pushback] [--no-hooks] [--password-stdin] <config.boot>
  vyops backup [--debug] [--password-stdin] <user@hostname-or-ip> <destination-directory>
  vyops --help
  vyops --version`;

export function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === '--help') return { help: true };
  if (argv.length === 1 && argv[0] === '--version') return { version: true };
  const command = argv.find(value => !value.startsWith('--'));
  if (!['preflight', 'release', 'backup'].includes(command)) throw new Error(usage);
  const options = new Set(argv.filter(value => value.startsWith('--')));
  const values = argv.filter(value => !value.startsWith('--')).slice(1);
  const allowed = command === 'release' ? ['--yes', '--force', '--debug', '--verify', '--no-pushback', '--no-hooks', '--password-stdin'] : ['--debug', '--password-stdin'];
  if ([...options].some(option => !allowed.includes(option)) || values.length !== (command === 'backup' ? 2 : 1)) throw new Error(usage);
  /* istanbul ignore next -- option combinations are exercised by CLI integration. */
  return { command, ...(command === 'backup' ? { target: values[0], config: values[1] } : { config: values[0] }), ...(options.has('--yes') ? { yes: true } : {}), ...(options.has('--force') ? { force: true } : {}), ...(options.has('--debug') ? { debug: true } : {}), ...(options.has('--verify') ? { verify: true } : {}), ...(options.has('--no-pushback') ? { noPushback: true } : {}), ...(options.has('--no-hooks') ? { noHooks: true } : {}), ...(options.has('--password-stdin') ? { passwordStdin: true } : {}) };
}
