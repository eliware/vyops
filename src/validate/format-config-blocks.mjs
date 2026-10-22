import { naturalCompare } from "./natural-compare.mjs";

export function formatConfigBlocks(units, depth = 0) {
  const sorted = [];
  for (let index = 0; index < units.length;) {
    if (units[index].type !== "block") {
      sorted.push(units[index++]);
      continue;
    }
    let end = index;
    while (end < units.length && units[end].type === "block") end += 1;
    sorted.push(
      ...units
        .slice(index, end)
        .sort((left, right) =>
          naturalCompare(left.key.replace(/\s*\{$/, ""), right.key.replace(/\s*\{$/, "")),
        ),
    );
    index = end;
  }
  return sorted.flatMap((unit) => {
    const indent = "    ".repeat(depth);
    if (unit.type === "blank") return [""];
    if (unit.type === "comment" || unit.type === "statement") return [`${indent}${unit.value}`];
    return [`${indent}${unit.key}`, ...formatConfigBlocks(unit.children, depth + 1), `${indent}}`];
  });
}
