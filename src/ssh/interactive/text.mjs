export function cleanInteractiveText(value) {
  const escape = String.fromCharCode(27);
  const ansi = new RegExp(`${escape}\\[[0-9;?]*[ -/]*[@-~]`, "g");
  const title = new RegExp(
    `${escape}\\][^${String.fromCharCode(7)}]*(?:${String.fromCharCode(7)}|${escape}\\\\)`,
    "g",
  );
  return value.replace(ansi, "").replace(title, "").replace(/\r/g, "");
}
