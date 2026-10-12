import { formatConfigBlocks } from "./format-config-blocks.mjs";
import { parseConfigBlocks } from "./parse-config-blocks.mjs";

export function fixConfig(text) {
  let output = formatConfigBlocks(parseConfigBlocks(text));
  const header = [];
  while (output[0]?.startsWith("//")) header.push(output.shift());
  while (output[0] === "") output.shift();
  while (output.at(-1) === "") output.pop();
  if (header.length) output.push("", "", ...header);
  return `${output.join("\n")}\n`;
}
