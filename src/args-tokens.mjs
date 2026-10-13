export function readCommandTokens(argv, usage) {
  const commandIndex = argv.findIndex((value) => value !== "--" && !value.startsWith("--"));
  const command = commandIndex === -1 ? undefined : argv[commandIndex];
  if (!command) throw new Error(usage);
  const valueStart = commandIndex + 1;
  const valueTerminator = argv.indexOf("--", valueStart);
  const valueEnd = valueTerminator === -1 ? argv.length : valueTerminator;
  const values = argv.slice(valueStart, valueEnd).filter((value) => !value.startsWith("--"));
  if (valueTerminator !== -1) values.push(...argv.slice(valueTerminator + 1));
  return {
    command,
    options: new Set(
      argv.filter(
        (value, index) =>
          value.startsWith("--") &&
          value !== "--" &&
          (valueTerminator === -1 || index < valueTerminator),
      ),
    ),
    values,
  };
}
