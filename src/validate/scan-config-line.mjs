import { fail } from "./error.mjs";

export function scanConfigLine(lineText, line) {
  let code = "";
  let quote = null;
  let escaped = false;
  let opening = -1;
  let closing = -1;
  for (let index = 0; index < lineText.length; index += 1) {
    const char = lineText[index];
    if (escaped) {
      escaped = false;
    } else if (quote && char === "\\") {
      escaped = true;
    } else if (char === '"' || char === "'") {
      quote = quote === char ? null : quote || char;
    } else if (!quote && char === "#") {
      break;
    } else if (!quote && char === "{") {
      if (opening >= 0) fail(line, "multiple opening braces on one line");
      opening = index;
    } else if (!quote && char === "}") {
      if (closing >= 0) fail(line, "multiple closing braces on one line");
      closing = index;
    }
    code += char;
  }
  if (quote) fail(line, "unterminated quotation mark");
  return { code, opening, closing };
}
