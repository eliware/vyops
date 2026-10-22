import { path } from "@eliware/common";
import { runGit as runGitDefault } from "../command.mjs";

const configDirectory = (config) => path(config, "..");

export async function repositoryRoot(config, gitRunner = runGitDefault) {
  try {
    const { stdout } = await gitRunner(["rev-parse", "--show-toplevel"], configDirectory(config));
    return stdout.trim();
  } catch (error) {
    if (error.stderr?.includes("not a git repository")) return null;
    throw error;
  }
}
