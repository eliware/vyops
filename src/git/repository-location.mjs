import { promises as fs } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { path } from "@eliware/common";
import { runGit as runGitDefault } from "./command.mjs";

const configDirectory = (config) => path(config, "..");

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

export async function repositoryRoot(config, gitRunner = runGitDefault) {
  try {
    const { stdout } = await gitRunner(["rev-parse", "--show-toplevel"], configDirectory(config));
    return stdout.trim();
  } catch (error) {
    if (error.stderr?.includes("not a git repository")) return null;
    throw error;
  }
}
