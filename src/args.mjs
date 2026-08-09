export const usage = `Usage:
  vyops [--dry-run] <user@hostname-or-ip> <config.boot>
  vyops --help
  vyops --version`;

export function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === '--help') return { help: true };
  if (argv.length === 1 && argv[0] === '--version') return { version: true };

  const dryRun = argv[0] === '--dry-run';
  const values = dryRun ? argv.slice(1) : argv;
  if (values.length !== 2) throw new Error(usage);
  return dryRun
    ? { target: values[0], config: values[1], dryRun: true }
    : { target: values[0], config: values[1] };
}
