import { readCommandOptions } from "./tokenization/options.mjs";
import { readCommandValues } from "./tokenization/values.mjs";

export function readCommandTokens(argv, usage) {
  const commandIndex = argv.findIndex((value) => value !== "--" && !value.startsWith("--"));
  const command = commandIndex === -1 ? undefined : argv[commandIndex];
  if (!command) throw new Error(usage);
  const valueStart = commandIndex + 1;
  const valueTerminator = argv.indexOf("--", valueStart);
  return {
    command,
    options: readCommandOptions(argv, valueTerminator),
    values: readCommandValues(argv, valueStart, valueTerminator),
  };
}
