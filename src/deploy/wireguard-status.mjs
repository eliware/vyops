export function hasNoWireGuardInterfaces(output) {
  const lines = output.split(/\r?\n/);
  const header = lines.findIndex((line) => /^\s*Interface\s+IP Address\b/i.test(line));
  if (header < 0) return false;
  const separator = lines.findIndex(
    (line, index) => index > header && /^\s*-{3,}\s+-{3,}/.test(line),
  );
  return separator >= 0 && lines.slice(separator + 1).every((line) => !line.trim());
}
