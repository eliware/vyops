import { validateCommandOptions } from "./args-validation.mjs";

export const usage = `Usage:
  vyops preflight [--debug] <config.boot>
  vyops release --yes [--force] [--debug] [--verify] [--verify-binaries] [--no-pushback] [--no-hooks requires --force] [--password-stdin] <config.boot>
  vyops backup [--debug] [--password-stdin] <user@hostname-or-ip> <destination-directory>
  vyops --help
  vyops --version`;

export function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === "--help") return { help: true };
  if (argv.length === 1 && argv[0] === "--version") return { version: true };
  const commandIndex = argv.findIndex((value) => !value.startsWith("--"));
  const command = commandIndex === -1 ? undefined : argv[commandIndex];
  if (!["preflight", "release", "backup"].includes(command)) throw new Error(usage);
  const afterCommand = argv.slice(commandIndex + 1);
  const options = new Set(argv.filter((value) => value.startsWith("--")));
  const values = afterCommand.filter((value) => !value.startsWith("--"));
  validateCommandOptions(command, options, values.length, usage);
  // codescope ignore: next option combinations are exercised by CLI integration.
  return {
    command,
    ...(command === "backup" ? { target: values[0], config: values[1] } : { config: values[0] }),
    ...(options.has("--yes") ? { yes: true } : {}),
    ...(options.has("--force") ? { force: true } : {}),
    ...(options.has("--debug") ? { debug: true } : {}),
    ...(options.has("--verify") ? { verify: true } : {}),
    ...(options.has("--verify-binaries") ? { verifyBinaries: true } : {}),
    ...(options.has("--no-pushback") ? { noPushback: true } : {}),
    ...(options.has("--no-hooks") ? { noHooks: true } : {}),
    ...(options.has("--password-stdin") ? { passwordStdin: true } : {}),
  };
}
