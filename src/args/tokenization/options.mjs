export function readCommandOptions(argv, valueTerminator) {
  return new Set(
    argv.filter(
      (value, index) =>
        value.startsWith("--") &&
        value !== "--" &&
        (valueTerminator === -1 || index < valueTerminator),
    ),
  );
}
