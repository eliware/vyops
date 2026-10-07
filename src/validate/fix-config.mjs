function naturalCompare(a, b) {
  if (a.startsWith(b) && a !== b) return 1;
  if (b.startsWith(a) && a !== b) return -1;
  const aa = a.split(/(\d+)/),
    bb = b.split(/(\d+)/);
  for (let i = 0; i < Math.min(aa.length, bb.length); i += 1) {
    const an = /^\d+$/.test(aa[i]),
      bn = /^\d+$/.test(bb[i]);
    if (an && bn && Number(aa[i]) !== Number(bb[i])) return Number(aa[i]) - Number(bb[i]);
    if (aa[i] !== bb[i]) return aa[i] < bb[i] ? -1 : 1;
  }
  return aa.length - bb.length || 0;
}

export function fixConfig(text) {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim());
  let index = 0;

  const parseLevel = (depth) => {
    const units = [];
    while (index < lines.length) {
      const trimmed = lines[index++];
      if (!trimmed) {
        units.push({ key: "", lines: [""] });
        continue;
      }
      if (trimmed.startsWith("#"))
        units.push({ key: "", lines: [`${"    ".repeat(depth)}${trimmed}`] });
      else if (trimmed === "}") {
        if (depth === 0)
          throw new Error(`config validation failed: unexpected closing brace at line ${index}`);
        return { units, closed: true };
      } else if (trimmed.endsWith("{")) {
        const header = trimmed;
        const children = parseLevel(depth + 1);
        if (!children.closed)
          throw new Error(`config validation failed: unbalanced braces at line ${index}`);
        units.push({
          key: header,
          lines: [
            `${"    ".repeat(depth)}${header}`,
            ...children.units.flatMap((unit) => unit.lines),
            `${"    ".repeat(depth)}}`,
          ],
        });
      } else units.push({ key: trimmed, lines: [`${"    ".repeat(depth)}${trimmed}`] });
    }

    for (let i = 0; i < units.length;) {
      if (!units[i].key.endsWith("{")) {
        i += 1;
        continue;
      }
      let end = i;
      while (end < units.length && units[end].key.endsWith("{")) end += 1;
      units.splice(
        i,
        end - i,
        ...units
          .slice(i, end)
          .sort((a, b) => naturalCompare(a.key.replace(/\s*\{$/, ""), b.key.replace(/\s*\{$/, ""))),
      );
      i = end;
    }
    return { units, closed: false };
  };

  const parsed = parseLevel(0);
  let output = parsed.units.flatMap((unit) => unit.lines);
  const header = [];
  while (output[0]?.startsWith("//")) header.push(output.shift());
  while (output[0] === "") output.shift();
  while (output.at(-1) === "") output.pop();
  if (header.length) output.push("", "", ...header);
  return `${output.join("\n")}\n`;
}
