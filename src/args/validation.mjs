import { validateCommandOptionPolicy } from "./option-policy.mjs";
import { validateCommandPositionals } from "./positional-validation.mjs";

export function validateCommandOptions(command, options, valueCount, usage) {
  validateCommandOptionPolicy(command, options, usage);
  validateCommandPositionals(command, valueCount, usage);
}
