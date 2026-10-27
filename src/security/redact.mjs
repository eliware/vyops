export function redactSensitiveValues(value, secretValue) {
  return String(value)
    .replaceAll(secretValue || "", secretValue ? "[redacted]" : "")
    .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g, "[private-key redacted]")
    .replace(
      /\b(password|passwd|secret|token|community)\s*(?:=|:)\s*(?:"[^"]*"|'[^']*'|[^\s,;)}]+)/gi,
      "$1=[redacted]",
    )
    .replace(
      /\b(password|passwd|secret|token|community)\s+(?![\w-]+:)(?:"[^"]*"|'[^']*'|[^\s,;)}]+)/gi,
      "$1 [redacted]",
    )
    .replace(
      /\b(authorization|x-api-key|api[-_ ]?key|private[-_ ]?key)\s*:\s*\S+/gi,
      "$1: [redacted]",
    )
    .replace(/\b[\w-]*key\s*:\s*\S+/gi, "[redacted]");
}
