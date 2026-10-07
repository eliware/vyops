export function commandSummary(command) {
  return String(command).replace(/\s+/g, " ").trim().slice(0, 240);
}
