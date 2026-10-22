export function selectCommand(argv, usage) {
  const commandIndex = argv.findIndex((value) => value !== "--" && !value.startsWith("--"));
  const command = commandIndex === -1 ? undefined : argv[commandIndex];
  if (!command) throw new Error(usage);
  return { command, valueStart: commandIndex + 1 };
}
