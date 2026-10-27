import { redactSensitiveValues } from "../security/redact.mjs";

export function commandSummary(command) {
  return redactSensitiveValues(command).replace(/\s+/g, " ").trim().slice(0, 240);
}
