import { lexConfigLine } from "../../config/lexer.mjs";
import { groupConfigBraces } from "../../config/braces.mjs";

export function findConfigBlockOpening(source, name) {
  const declaration = new RegExp(`^[\\t ]*${name}\\s*\\{`);
  let offset = 0;
  let quote = null;
  for (const text of source.split("\n")) {
    const lineOffset = offset;
    offset += text.length + 1;
    const quoteAtLineStart = quote;
    const { code, braces, quote: nextQuote } = lexConfigLine(text, quote);
    quote = nextQuote;
    if (quoteAtLineStart) continue;
    const match = declaration.exec(code);
    if (!match) continue;
    const braceIndex = match[0].lastIndexOf("{");
    if (groupConfigBraces(braces).opening.some(({ index }) => index === braceIndex))
      return lineOffset + braceIndex;
  }
  return -1;
}
