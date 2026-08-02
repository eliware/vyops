export function parseArgs(argv) {
  if (argv.length !== 2) throw new Error('usage: vyops.mjs <user@hostname-or-ip> <config.boot>');
  return { target: argv[0], config: argv[1] };
}
