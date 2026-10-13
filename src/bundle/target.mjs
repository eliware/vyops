import { configBlock } from "./config-block.mjs";

export function targetFromConfig(text) {
  const system = configBlock(text, "system");
  const host = system
    .match(
      /(?:^|\n)\s*host-name\s+(?:"([A-Za-z0-9][A-Za-z0-9._-]*)"|'([A-Za-z0-9][A-Za-z0-9._-]*)'|([A-Za-z0-9][A-Za-z0-9._-]*))(?:\s*(?:#.*)?$)/m,
    )
    ?.slice(1)
    .find(Boolean);
  const login = configBlock(system, "login");
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
