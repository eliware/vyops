import { promises as fs } from "node:fs";
import { relative, resolve, sep } from "node:path";

export async function relativeConfigPath(repo, config) {
  const [canonicalRepo, canonicalConfig] = await Promise.all([
    fs.realpath(repo),
    fs.realpath(resolve(config)),
  ]);
  const relativePath = relative(canonicalRepo, canonicalConfig);
  if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
    throw new Error("configuration path is outside the Git repository");
  }
  return relativePath;
}
