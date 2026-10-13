import { validateCommandOptionPolicy } from "./args-option-policy.mjs";
import { validateCommandPositionals } from "./args-positional-validation.mjs";

export function validateCommandOptions(command, options, valueCount, usage) {
  validateCommandOptionPolicy(command, options, usage);
  validateCommandPositionals(command, valueCount, usage);
}
