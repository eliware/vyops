function isEscaped(source, index) {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) slashes += 1;
  return slashes % 2 === 1;
}

export function configBlock(source, name) {
  let quote = "";
  let comment = false;
  const declaration = new RegExp(`^[\\t ]*${name}\\s*\\{`);
  let opening = -1;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (comment) {
      if (character === "\n") comment = false;
      continue;
    }
    if (quote) {
      if (character === quote && !isEscaped(source, index)) quote = "";
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
    if ((index === 0 || source[index - 1] === "\n") && declaration.test(source.slice(index))) {
      const match = declaration.exec(source.slice(index));
      opening = index + match[0].lastIndexOf("{");
      break;
    }
  }
  if (opening < 0) return "";

  let depth = 1;
  quote = "";
  comment = false;
  for (let index = opening + 1; index < source.length; index += 1) {
    const character = source[index];
    if (comment) {
      if (character === "\n") comment = false;
      continue;
    }
    if (quote) {
      if (character === quote && !isEscaped(source, index)) quote = "";
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
    if (character === "}" && --depth === 0) return source.slice(opening + 1, index);
  }
  return "";
}
