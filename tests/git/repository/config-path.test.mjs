import {
  promises,
  resetMemoryFilesystem,
} from "../../../test-fixtures/helpers/memory-filesystem.mjs";
import { jest } from "@jest/globals";
await import("../../../test-fixtures/helpers/memory-filesystem-setup.mjs");
beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs/promises", () => promises);
const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
import { join } from "node:path";
const { createGitWorkspace, removeGitWorkspace } =
  await import("../../../test-fixtures/git-harness.mjs");
const { relativeConfigPath } = await import("../../../src/git/repository/config-path.mjs");

test("resolves config paths inside a repository and rejects paths outside it", async () => {
  const { directory, config } = await createGitWorkspace();
  const outside = await mkdtemp(join("/virtual", "vyops-outside-"));
  const outsideConfig = join(outside, "config.boot");
  await writeFile(outsideConfig, "system {}\n");
  try {
    await expect(relativeConfigPath(directory, config)).resolves.toBe("config.boot");
    await expect(relativeConfigPath(directory, outsideConfig)).rejects.toThrow(
      "configuration path is outside the Git repository",
    );
  } finally {
    await rm(outside, { recursive: true, force: true });
    await removeGitWorkspace(directory);
  }
});
