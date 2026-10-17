import { promises } from "./helpers/memory-filesystem.mjs";
import { join } from "node:path";

export async function createGitWorkspace(prefix = "vyops-git-test-", root = undefined) {
  const directory = root || (await promises.mkdtemp(join("/virtual", prefix)));
  if (root) await promises.mkdir(directory, { recursive: true });
  await promises.mkdir(join(directory, ".git"));
  const config = join(directory, "config.boot");
  await promises.writeFile(config, "system {}\n");
  await promises.writeFile(`${config}.manifest.tsv`, "kind\tpath\n");
  return { directory, config };
}

export async function removeGitWorkspace(directory) {
  await promises.rm(directory, { recursive: true, force: true });
}

export function createGitMock(jest, directory, override = () => undefined) {
  return jest.fn(async (args) => {
    const result = await override(args);
    if (result !== undefined) return result;
    if (args[0] === "rev-parse" && args[1] === "--show-toplevel")
      return { stdout: `${directory}\n` };
    if (args[0] === "ls-files" && args.at(-1) === "config.boot.manifest.tsv")
      return { stdout: "config.boot.manifest.tsv\n" };
    if (args[0] === "ls-files")
      throw Object.assign(new Error("path is not tracked"), { stderr: "path is not tracked" });
    if (args[0] === "rev-parse" && args[1] === "HEAD") return { stdout: "head\n" };
    if (args[0] === "symbolic-ref") return { stdout: "main\n" };
    if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "origin/main\n" };
    if (args[0] === "status" || args[0] === "diff") return { stdout: "" };
    return { stdout: "" };
  });
}
