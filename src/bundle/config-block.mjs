import { lexConfigLine } from "../config/lexer.mjs";

function linesWithOffsets(source) {
  let offset = 0;
  return source.split("\n").map((text) => {
    const line = { text, offset };
    offset += text.length + 1;
    return line;
  });
}

export function configBlock(source, name) {
  const declaration = new RegExp(`^[\\t ]*${name}\\s*\\{`);
  let opening = -1;
  const lines = linesWithOffsets(source);
  let quote = null;

  for (const line of lines) {
    const quoteAtLineStart = quote;
    const { code, braces, quote: nextQuote } = lexConfigLine(line.text, quote);
    quote = nextQuote;
    if (quoteAtLineStart) continue;
    const match = declaration.exec(code);
    if (!match) continue;
    const braceIndex = match[0].lastIndexOf("{");
    if (braces.some(({ character, index }) => character === "{" && index === braceIndex)) {
      opening = line.offset + braceIndex;
      break;
    }
  }
  if (opening < 0) return "";

  let depth = 1;
  quote = null;
  for (const line of lines) {
    const { braces, quote: nextQuote } = lexConfigLine(line.text, quote);
    quote = nextQuote;
    for (const brace of braces) {
      const offset = line.offset + brace.index;
      if (offset <= opening) continue;
      if (brace.character === "{") depth += 1;
      else if (--depth === 0) return source.slice(opening + 1, offset);
    }
  }
  return "";
}
