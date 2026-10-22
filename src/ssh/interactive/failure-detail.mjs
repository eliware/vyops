export function interactiveFailureDetail(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /(?:failed|failure|invalid|error|aborted|pending)/i.test(line))
    ?.replace(/(certificate|private key|key)\s+"[^"]+"/gi, '$1 "[redacted]"')
    .replace(/\s+/g, " ")
    .slice(0, 240);
}
