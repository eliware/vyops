import { promises, resetMemoryFilesystem } from "../test-fixtures/helpers/memory-filesystem.mjs";
import "../test-fixtures/helpers/memory-filesystem-setup.mjs";
import { jest } from "@jest/globals";

beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs/promises", () => promises);
const { mkdtemp, mkdir, rm } = await import("node:fs/promises");
const { join } = await import("node:path");
const { validateBundle } = await import("../src/bundle.mjs");

test("extracts a target by default and omits it when target extraction is disabled", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-bundle-"));
  await mkdir(join(root, "scripts"), { recursive: true });
  const config = join(root, "config.boot");
  const text = "system {\n host-name router\n login {\n user vyos {\n }\n }\n}\n";
  try {
    await expect(validateBundle(config, text)).resolves.toEqual({
      target: "vyos@router",
      scripts: [],
    });
    await expect(validateBundle(config, text, { extractTarget: false })).resolves.toEqual({
      scripts: [],
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
