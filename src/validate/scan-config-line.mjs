import { lexConfigLine } from "../config/lexer.mjs";
import { groupConfigBraces } from "../config/braces.mjs";
import { fail } from "./error.mjs";

export function scanConfigLine(lineText, line) {
  const { code, braces, unterminatedQuote } = lexConfigLine(lineText);
  const { opening: openings, closing: closings } = groupConfigBraces(braces);
  if (openings.length > 1) fail(line, "multiple opening braces on one line");
  if (closings.length > 1) fail(line, "multiple closing braces on one line");
  if (unterminatedQuote) fail(line, "unterminated quotation mark");
  return { code, opening: openings[0]?.index ?? -1, closing: closings[0]?.index ?? -1 };
}
