import * as fs from "node:fs/promises";
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  downloadFilesToReplace,
  downloadToReplace,
} from "../../src/deploy/download-to-replace.mjs";

test("replaces a local file after the download completes", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-download-"));
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
  const root = await mkdtemp(join(tmpdir(), "vyops-download-"));
  const local = join(root, "config.boot");
  await writeFile(local, "old");
  try {
    await expect(
      downloadToReplace(
        fs,
        async () => {
          throw new Error("download failed");
        },
        {},
        "/remote",
        local,
      ),
    ).rejects.toThrow("download failed");
    await expect(readFile(local, "utf8")).resolves.toBe("old");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restores both old files when the second local replacement fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "vyops-download-"));
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
  const root = await mkdtemp(join(tmpdir(), "vyops-download-"));
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
  const root = await mkdtemp(join(tmpdir(), "vyops-download-"));
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
