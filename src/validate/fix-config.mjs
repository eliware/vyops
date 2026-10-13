import { formatConfigBlocks } from "./format-config-blocks.mjs";
import { parseConfigBlocks } from "./parse-config-blocks.mjs";
import { relocateHeaderComments } from "./header-comments.mjs";

export function fixConfig(text) {
  const output = relocateHeaderComments(formatConfigBlocks(parseConfigBlocks(text)));
  return `${output.join("\n")}\n`;
}
