import { promises, resetMemoryFilesystem } from "../../test-fixtures/helpers/memory-filesystem.mjs";
import { jest } from "@jest/globals";
await import("../../test-fixtures/helpers/memory-filesystem-setup.mjs");
beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs/promises", () => promises);
const { mkdtemp, rm, writeFile } = await import("node:fs/promises");
import { join } from "node:path";
const { readAndValidateConfig } = await import("../../src/validate/config-file.mjs");

test("reads and validates the configuration file", async () => {
  const directory = await mkdtemp(join("/virtual", "vyops-validate-"));
  const path = join(directory, "config.boot");
  const config = "system {\n    host-name router\n}\n";
  await writeFile(path, config);
  try {
    await expect(readAndValidateConfig(path)).resolves.toBe(config);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
