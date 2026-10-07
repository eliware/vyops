import { promises as fs } from "node:fs";
import { resolve } from "node:path";

export async function pushbackPaths(git, repo, configPath) {
  const paths = [configPath];
  const manifestPath = `${configPath}.manifest.tsv`;
  const tracked = await git(["ls-files", "--error-unmatch", "--", manifestPath], repo).then(
    () => true,
    () => false,
  );
  const present = await fs.access(resolve(repo, manifestPath)).then(
    () => true,
    () => false,
  );
  if (tracked || present) paths.push(manifestPath);
  return paths;
}
