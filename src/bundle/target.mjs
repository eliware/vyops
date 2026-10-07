export function targetFromConfig(text) {
  const block = (source, name) => {
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
  };
  const system = block(text, "system");
  const host = system
    .match(
      /(?:^|\n)\s*host-name\s+(?:"([A-Za-z0-9][A-Za-z0-9._-]*)"|'([A-Za-z0-9][A-Za-z0-9._-]*)'|([A-Za-z0-9][A-Za-z0-9._-]*))(?:\s*(?:#.*)?$)/m,
    )
    ?.slice(1)
    .find(Boolean);
  const login = block(system, "login");
  const users = [...login.matchAll(/(?:^|\n)\s*user\s+([A-Za-z0-9._-]+)\s*\{/g)].map(
    (match) => match[1],
  );
  if (!host) throw new Error("preflight failed: config does not define system host-name");
  if (users.length !== 1)
    throw new Error(
      `preflight failed: expected exactly one system login user; found ${users.length}`,
    );
  return `${users[0]}@${host}`;
}
