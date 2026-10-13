import { validateCommandOptions } from "./args-validation.mjs";
import { buildArgsResult } from "./args-result.mjs";
import { readCommandTokens } from "./args-tokens.mjs";

export const usage = `Usage:
  vyops preflight [--debug] <config.boot>
  vyops release --yes [--force] [--debug] [--verify] [--verify-binaries] [--no-pushback] [--no-hooks requires --force] [--password-stdin] <config.boot>
  vyops backup [--debug] [--password-stdin] <user@hostname-or-ip> <destination-directory>
  vyops --help
  vyops --version`;

export function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === "--help") return { help: true };
  if (argv.length === 1 && argv[0] === "--version") return { version: true };
  const { command, options, values } = readCommandTokens(argv, usage);
  if (!["preflight", "release", "backup"].includes(command)) throw new Error(usage);
  validateCommandOptions(command, options, values.length, usage);
  return buildArgsResult(command, options, values);
}
