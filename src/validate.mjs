import { fs } from "@eliware/common";
import { fail, validateConfigLine } from "./validate/line.mjs";

export function validateConfig(text) {
  if (!text.trim()) throw new Error("config validation failed: file is empty");

  let depth = 0;
  let hasStatement = false;
  let line = 1;
  let lineText = "";

  for (const char of text) {
    if (char === "\n") {
      const result = validateConfigLine(lineText, depth, line);
      depth = result.depth;
      hasStatement ||= result.hasStatement;
      lineText = "";
      line += 1;
    } else lineText += char;
  }
  const result = validateConfigLine(lineText, depth, line);
  depth = result.depth;
  hasStatement ||= result.hasStatement;
  if (depth !== 0) fail(line, "unbalanced braces");
  if (!hasStatement) throw new Error("config validation failed: no configuration statements");
  return text;
}

export async function readAndValidateConfig(path) {
  const text = await fs.promises.readFile(path, "utf8");
  return validateConfig(text);
}
