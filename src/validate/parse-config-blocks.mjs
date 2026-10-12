export function parseConfigBlocks(text) {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim());
  let index = 0;

  const parseLevel = (depth) => {
    const units = [];
    while (index < lines.length) {
      const value = lines[index++];
      if (!value) units.push({ type: "blank" });
      else if (value.startsWith("#")) units.push({ type: "comment", value });
      else if (value === "}") {
        if (depth === 0)
          throw new Error(`config validation failed: unexpected closing brace at line ${index}`);
        return { units, closed: true };
      } else if (value.endsWith("{")) {
        const children = parseLevel(depth + 1);
        if (!children.closed)
          throw new Error(`config validation failed: unbalanced braces at line ${index}`);
        units.push({ type: "block", key: value, children: children.units });
      } else units.push({ type: "statement", value });
    }
    return { units, closed: false };
  };

  return parseLevel(0).units;
}
