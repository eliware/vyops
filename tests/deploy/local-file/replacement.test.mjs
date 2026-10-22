import {
  promises,
  resetMemoryFilesystem,
} from "../../../test-fixtures/helpers/memory-filesystem.mjs";
import { jest } from "@jest/globals";
await import("../../../test-fixtures/helpers/memory-filesystem-setup.mjs");
beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs/promises", () => promises);
const fs = await import("node:fs/promises");
const { mkdtemp, readFile, rm, writeFile } = await import("node:fs/promises");
import { join } from "node:path";
const { downloadToReplace } = await import("../../../src/deploy/local-file/replacement.mjs");
test("replaces a local file after the download completes", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-download-"));
  const local = join(root, "config.boot");
  await writeFile(local, "old");
  const download = async (_client, _remote, temporary) => writeFile(temporary, "new");
  try {
    await downloadToReplace(fs, download, {}, "/remote", local);
    await expect(readFile(local, "utf8")).resolves.toBe("new");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("preserves the old file when the download fails", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-download-"));
  const local = join(root, "config.boot");
  const log = { warn: jest.fn() };
  const fsApi = {
    ...fs,
    rm: async (target, options) => {
      if (target.includes(".vyops-")) throw new Error("temporary cleanup denied");
      return rm(target, options);
    },
  };
  await writeFile(local, "old");
  try {
    await expect(
      downloadToReplace(
        fsApi,
        async () => {
          throw new Error("download failed");
        },
        {},
        "/remote",
        local,
        log,
      ),
    ).rejects.toThrow("download failed");
    await expect(readFile(local, "utf8")).resolves.toBe("old");
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("temporary cleanup denied"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
