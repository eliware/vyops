export const usage = `Usage:
  vyops [--dry-run] [--force] [--debug] [--password-stdin] <user@hostname-or-ip> <config.boot>
  vyops --backup [--debug] [--password-stdin] <user@hostname-or-ip> <destination-directory>
  vyops --help
  vyops --version`;

export function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === '--help') return { help: true };
  if (argv.length === 1 && argv[0] === '--version') return { version: true };

  const options = new Set(argv.filter(value => value.startsWith('--')));
  if ([...options].some(option => !['--dry-run', '--force', '--debug', '--backup', '--password-stdin'].includes(option))) throw new Error(usage);
  const values = argv.filter(value => !value.startsWith('--'));
  if (values.length !== 2) throw new Error(usage);
  return { target: values[0], config: values[1], ...(options.has('--backup') ? { backup: true } : {}), ...(options.has('--dry-run') ? { dryRun: true } : {}), ...(options.has('--force') ? { force: true } : {}), ...(options.has('--debug') ? { debug: true } : {}), ...(options.has('--password-stdin') ? { passwordStdin: true } : {}) };
}
