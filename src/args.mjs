import { validateCommandOptions } from "./args-validation.mjs";
import { buildArgsResult } from "./args-result.mjs";
import { readCommandTokens } from "./args-tokens.mjs";
import { parseSpecialArgs } from "./args-special.mjs";
import { usage } from "./cli/usage.mjs";

export function parseArgs(argv) {
  const special = parseSpecialArgs(argv);
  if (special) return special;
  const { command, options, values } = readCommandTokens(argv, usage);
  if (!["preflight", "release", "backup"].includes(command)) throw new Error(usage);
  validateCommandOptions(command, options, values.length, usage);
  return buildArgsResult(command, options, values);
}
