import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function createGitWorkspace(prefix = "vyops-git-test-") {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  await mkdir(join(directory, ".git"));
  const config = join(directory, "config.boot");
  await writeFile(config, "system {}\n");
  await writeFile(`${config}.manifest.tsv`, "kind\tpath\n");
  return { directory, config };
}

export async function removeGitWorkspace(directory) {
  await rm(directory, { recursive: true, force: true });
}

export function createGitMock(jest, directory, override = () => undefined) {
  return jest.fn(async (args) => {
    const result = await override(args);
    if (result !== undefined) return result;
    if (args[0] === "rev-parse" && args[1] === "--show-toplevel")
      return { stdout: `${directory}\n` };
    if (args[0] === "ls-files") return { stdout: "config.boot.manifest.tsv\n" };
    if (args[0] === "rev-parse" && args[1] === "HEAD") return { stdout: "head\n" };
    if (args[0] === "symbolic-ref") return { stdout: "main\n" };
    if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return { stdout: "origin/main\n" };
    if (args[0] === "status" || args[0] === "diff") return { stdout: "" };
    return { stdout: "" };
  });
}
