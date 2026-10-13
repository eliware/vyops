export function configBlock(source, name) {
  const match = new RegExp(`(?:^|\\n)\\s*${name}\\s*\\{`).exec(source);
  if (!match) return "";
  const start = match.index + match[0].lastIndexOf("{") + 1;
  let depth = 1;
  let quote = "";
  let comment = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (comment) {
      if (character === "\n") comment = false;
      continue;
    }
    if (quote) {
      if (character === quote && source[index - 1] !== "\\") quote = "";
      continue;
    }
    if (character === "#") {
      comment = true;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return source.slice(start, index);
  }
  return "";
}
