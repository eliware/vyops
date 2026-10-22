import { jest } from "@jest/globals";
import { join } from "node:path";

const { filesIn } = await import("../../../src/bundle/script/tree.mjs");
const entry = (name, type) => ({
  name,
  isDirectory: () => type === "directory",
  isFile: () => type === "file",
});

test("lists nested files with paths relative to the script root", async () => {
  const root = join("/bundle", "scripts");
  const fsApi = {
    readdir: jest
      .fn()
      .mockResolvedValueOnce([entry("nested", "directory"), entry("plain.txt", "file")])
      .mockResolvedValueOnce([entry("hook.sh", "file")]),
  };

  await expect(filesIn(root, fsApi)).resolves.toEqual([
    { file: join(root, "nested", "hook.sh"), name: "nested/hook.sh" },
    { file: join(root, "plain.txt"), name: "plain.txt" },
  ]);
});

test("returns no files when the script directory does not exist", async () => {
  const fsApi = {
    readdir: jest.fn().mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" })),
  };
  await expect(filesIn("/bundle/scripts", fsApi)).resolves.toEqual([]);
});

test("propagates errors from a non-directory script path", async () => {
  const fsApi = {
    readdir: jest
      .fn()
      .mockRejectedValue(Object.assign(new Error("not a directory"), { code: "ENOTDIR" })),
  };
  await expect(filesIn("/bundle/scripts", fsApi)).rejects.toMatchObject({
    code: "ENOTDIR",
  });
});

test("ignores symlink-like entries and propagates other traversal errors", async () => {
  const fsApi = { readdir: jest.fn().mockResolvedValue([entry("link.sh", "link")]) };
  await expect(filesIn("/bundle/scripts", fsApi)).resolves.toEqual([]);
  const error = Object.assign(new Error("denied"), { code: "EACCES" });
  fsApi.readdir.mockRejectedValueOnce(error);
  await expect(filesIn("/bundle/scripts", fsApi)).rejects.toBe(error);
});
