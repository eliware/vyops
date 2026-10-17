export function cleanInteractiveText(value) {
  const escape = String.fromCharCode(27);
  const ansi = new RegExp(`${escape}\\[[0-9;?]*[ -/]*[@-~]`, "g");
  const title = new RegExp(
    `${escape}\\][^${String.fromCharCode(7)}]*(?:${String.fromCharCode(7)}|${escape}\\\\)`,
    "g",
  );
  return value.replace(ansi, "").replace(title, "").replace(/\r/g, "");
}

export function interactiveFailureDetail(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /(?:failed|failure|invalid|error|aborted|pending)/i.test(line))
    ?.replace(/(certificate|private key|key)\s+"[^"]+"/gi, '$1 "[redacted]"')
    .replace(/\s+/g, " ")
    .slice(0, 240);
}
