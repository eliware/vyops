import { lexConfigLine } from "../../config/lexer.mjs";
import { groupConfigBraces } from "../../config/braces.mjs";

export function extractConfigBlock(source, opening) {
  if (opening < 0) return "";
  let depth = 1;
  let offset = 0;
  let quote = null;
  for (const text of source.split("\n")) {
    const lineOffset = offset;
    offset += text.length + 1;
    const { braces, quote: nextQuote } = lexConfigLine(text, quote);
    quote = nextQuote;
    for (const brace of groupConfigBraces(braces).ordered) {
      const braceOffset = lineOffset + brace.index;
      if (braceOffset <= opening) continue;
      if (brace.character === "{") depth += 1;
      else if (--depth === 0) return source.slice(opening + 1, braceOffset);
    }
  }
  return "";
}
