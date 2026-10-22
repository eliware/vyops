import { readCommandOptions } from "./tokenization/options.mjs";
import { readCommandValues } from "./tokenization/values.mjs";
import { selectCommand } from "./command.mjs";

export function readCommandTokens(argv, usage) {
  const { command, valueStart } = selectCommand(argv, usage);
  const valueTerminator = argv.indexOf("--", valueStart);
  return {
    command,
    options: readCommandOptions(argv, valueTerminator),
    values: readCommandValues(argv, valueStart, valueTerminator),
  };
}
