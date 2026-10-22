import { promises, resetMemoryFilesystem } from "../../test-fixtures/helpers/memory-filesystem.mjs";
import { jest } from "@jest/globals";
await import("../../test-fixtures/helpers/memory-filesystem-setup.mjs");
beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs/promises", () => promises);
const fs = await import("node:fs/promises");
const { mkdtemp, readFile, readdir, rename, rm, writeFile } = await import("node:fs/promises");
import { join } from "node:path";
const { downloadFilesToReplace } = await import("../../src/deploy/download-to-replace.mjs");

test("restores both old files when the second local replacement fails", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-download-"));
  const config = join(root, "config.boot");
  const manifest = `${config}.deployment.tsv`;
  await writeFile(config, "old config");
  await writeFile(manifest, "old manifest");
  const fsApi = {
    ...fs,
    rename: async (source, destination) => {
      if (source.includes(".vyops-") && destination === manifest)
        throw new Error("second replacement failed");
      return rename(source, destination);
    },
  };
  try {
    await expect(
      downloadFilesToReplace(
        fsApi,
        async (_client, remote, temporary) => writeFile(temporary, remote),
        {},
        [
          { remote: "/config/config.boot", local: config },
          { remote: "/router/manifest", local: manifest },
        ],
      ),
    ).rejects.toThrow("second replacement failed");
    await expect(readFile(config, "utf8")).resolves.toBe("old config");
    await expect(readFile(manifest, "utf8")).resolves.toBe("old manifest");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("keeps prior files when saving the old state fails", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-download-"));
  const config = join(root, "config.boot");
  await writeFile(config, "old config");
  const fsApi = {
    ...fs,
    rename: async (source, destination) => {
      if (source === config && destination.includes(".previous-"))
        throw new Error("save prior file failed");
      return rename(source, destination);
    },
  };
  try {
    await expect(
      downloadFilesToReplace(
        fsApi,
        async (_client, _remote, local) => writeFile(local, "new"),
        {},
        [{ remote: "/config/config.boot", local: config }],
      ),
    ).rejects.toThrow("save prior file failed");
    await expect(readFile(config, "utf8")).resolves.toBe("old config");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("keeps prior files when local rollback fails", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-download-"));
  const config = join(root, "config.boot");
  const manifest = `${config}.deployment.tsv`;
  await writeFile(config, "old config");
  await writeFile(manifest, "old manifest");
  const fsApi = {
    ...fs,
    rename: async (source, destination) => {
      if (source.includes(".vyops-") && destination === manifest)
        throw new Error("replacement failed");
      if (source.includes(".previous-") && destination === config)
        throw new Error("rollback failed");
      return rename(source, destination);
    },
  };
  try {
    await expect(
      downloadFilesToReplace(
        fsApi,
        async (_client, remote, temporary) => writeFile(temporary, remote),
        {},
        [
          { remote: "/config/config.boot", local: config },
          { remote: "/router/manifest", local: manifest },
        ],
      ),
    ).rejects.toThrow("local release state rollback failed: rollback failed");
    expect((await readdir(root)).some((name) => name.includes(".previous-"))).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reports cleanup failures without changing the successful replacement result", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-download-"));
  const local = join(root, "config.boot");
  const log = { warn: jest.fn() };
  const fsApi = {
    ...fs,
    rm: async (target, options) => {
      if (target.includes(".previous-") || target.includes(".vyops-"))
        throw new Error("cleanup denied");
      return rm(target, options);
    },
  };
  try {
    await expect(
      downloadFilesToReplace(
        fsApi,
        async (_client, _remote, temporary) => writeFile(temporary, "new"),
        {},
        [{ remote: "/config/config.boot", local }],
        log,
      ),
    ).resolves.toBeUndefined();
    await expect(readFile(local, "utf8")).resolves.toBe("new");
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("cleanup denied"));
    expect(log.warn).toHaveBeenCalledTimes(2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
