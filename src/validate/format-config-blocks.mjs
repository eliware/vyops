function naturalCompare(a, b) {
  if (a.startsWith(b) && a !== b) return 1;
  if (b.startsWith(a) && a !== b) return -1;
  const aa = a.split(/(\d+)/);
  const bb = b.split(/(\d+)/);
  for (let index = 0; index < Math.min(aa.length, bb.length); index += 1) {
    const an = /^\d+$/.test(aa[index]);
    const bn = /^\d+$/.test(bb[index]);
    if (an && bn && Number(aa[index]) !== Number(bb[index]))
      return Number(aa[index]) - Number(bb[index]);
    if (aa[index] !== bb[index]) return aa[index] < bb[index] ? -1 : 1;
  }
  return aa.length - bb.length || 0;
}

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
