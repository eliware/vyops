export function fail(line, message) {
  throw new Error(`config validation failed at line ${line}: ${message}`);
}

export function validateConfigLine(lineText, depth, line) {
  let code = "";
  let quote = null;
  let escaped = false;
  for (const char of lineText) {
    if (escaped) {
      code += char;
      escaped = false;
    } else if (quote && char === "\\") {
      code += char;
      escaped = true;
    } else if (char === '"' || char === "'") {
      quote = quote === char ? null : quote || char;
      code += char;
    } else if (!quote && char === "#") break;
    else code += char;
  }
  if (quote) fail(line, "unterminated quote");
  const trimmed = code.trim();
  if (!trimmed) return { depth, hasStatement: false };
  const expectedDepth = trimmed === "}" ? depth - 1 : depth;
  if (expectedDepth < 0) fail(line, "unexpected closing brace");
  const indent = "    ".repeat(expectedDepth);
  if (!lineText.startsWith(indent) || lineText.slice(indent.length).startsWith(" ")) {
    fail(line, `incorrect indentation; expected ${expectedDepth * 4} spaces`);
  }
  let opening = -1;
  let closing = -1;
  quote = null;
  escaped = false;
  for (let index = 0; index < code.length; index += 1) {
    const char = code[index];
    if (escaped) escaped = false;
    else if (quote && char === "\\") escaped = true;
    else if (char === '"' || char === "'") quote = quote === char ? null : quote || char;
    else if (!quote && char === "{") {
      if (opening >= 0) fail(line, "multiple opening braces on one line");
      opening = index;
    } else if (!quote && char === "}") {
      if (closing >= 0) fail(line, "multiple closing braces on one line");
      closing = index;
    }
  }
  if (opening >= 0 && closing >= 0)
    fail(line, "opening and closing brace must be on separate lines");
  if (opening >= 0) {
    if (!code.slice(0, opening).trim() || code.slice(opening + 1).trim()) {
      fail(line, "opening brace must end the line");
    }
    depth += 1;
  } else if (closing >= 0) {
    if (code.slice(0, closing).trim() || code.slice(closing + 1).trim()) {
      fail(line, "closing brace must be alone");
    }
    depth -= 1;
  }
  return { depth, hasStatement: true };
}
