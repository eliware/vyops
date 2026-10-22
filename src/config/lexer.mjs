export function lexConfigLine(lineText, initialQuote = null) {
  let code = "";
  let quote = initialQuote;
  let escaped = false;
  const braces = [];

  for (let index = 0; index < lineText.length; index += 1) {
    const character = lineText[index];
    if (quote) {
      code += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      code += character;
    } else if (character === "#") break;
    else {
      if (character === "{" || character === "}") braces.push({ character, index });
      code += character;
    }
  }
  return { code, braces, quote, unterminatedQuote: quote !== null };
}
