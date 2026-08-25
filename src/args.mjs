export const usage = `Usage:
  vyops preflight <config.boot>
  vyops release [--force] [--debug] [--password-stdin] <config.boot>
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
  const allowed = command === 'release' ? ['--force', '--debug', '--password-stdin'] : ['--debug', '--password-stdin'];
  if ([...options].some(option => !allowed.includes(option)) || values.length !== (command === 'backup' ? 2 : 1)) throw new Error(usage);
  return { command, ...(command === 'backup' ? { target: values[0], config: values[1] } : { config: values[0] }), ...(options.has('--force') ? { force: true } : {}), ...(options.has('--debug') ? { debug: true } : {}), ...(options.has('--password-stdin') ? { passwordStdin: true } : {}) };
}
