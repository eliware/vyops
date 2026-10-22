export function selectCommand(argv, usage) {
  const valueTerminator = argv.indexOf("--");
  const commandEnd = valueTerminator === -1 ? argv.length : valueTerminator;
  const commandIndex = argv.findIndex(
    (value, index) => index < commandEnd && !value.startsWith("--"),
  );
  const command = commandIndex === -1 ? undefined : argv[commandIndex];
  if (!command) throw new Error(usage);
  return { command, valueStart: commandIndex + 1 };
}
