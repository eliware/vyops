export function parseSpecialArgs(argv) {
  if (argv.length === 1 && argv[0] === "--help") return { help: true };
  if (argv.length === 1 && argv[0] === "--version") return { version: true };
  return null;
}
