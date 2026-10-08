import * as fs from "node:fs/promises";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { downloadToReplace } from "../../src/deploy/download-to-replace.mjs";

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
