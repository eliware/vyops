export function readCommandTokens(argv, usage) {
  const commandIndex = argv.findIndex((value) => !value.startsWith("--"));
  const command = commandIndex === -1 ? undefined : argv[commandIndex];
  if (!command) throw new Error(usage);
  return {
    command,
    options: new Set(argv.filter((value) => value.startsWith("--"))),
    values: argv.slice(commandIndex + 1).filter((value) => !value.startsWith("--")),
  };
}
