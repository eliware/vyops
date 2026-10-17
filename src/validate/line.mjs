import { fail } from "./error.mjs";
import { scanConfigLine } from "./scan-config-line.mjs";

export { fail } from "./error.mjs";

export function validateConfigLine(lineText, depth, line) {
  const { code, opening, closing } = scanConfigLine(lineText, line);
  const trimmed = code.trim();
  if (!trimmed) return { depth, hasStatement: false };
  const expectedDepth = trimmed === "}" ? depth - 1 : depth;
  if (expectedDepth < 0) fail(line, "unexpected closing curly bracket");
  const indent = "    ".repeat(expectedDepth);
  if (!lineText.startsWith(indent) || lineText.slice(indent.length).startsWith(" ")) {
    fail(line, `incorrect indentation. Expected ${expectedDepth * 4} spaces.`);
  }
  if (opening >= 0 && closing >= 0)
    fail(line, "opening and closing curly bracket must be on separate lines");
  if (opening >= 0) {
    if (!code.slice(0, opening).trim() || code.slice(opening + 1).trim()) {
      fail(line, "opening curly bracket must end the line");
    }
    depth += 1;
  } else if (closing >= 0) {
    if (code.slice(0, closing).trim() || code.slice(closing + 1).trim()) {
      fail(line, "closing curly bracket must be alone");
    }
    depth -= 1;
  }
  return { depth, hasStatement: true };
}
