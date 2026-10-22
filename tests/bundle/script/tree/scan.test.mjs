import { jest } from "@jest/globals";
import { scanTree } from "../../../../src/bundle/script/tree/scan.mjs";

const entry = (name, type) => ({
  name,
  isDirectory: () => type === "directory",
  isFile: () => type === "file",
});

test("scans nested files and excludes links and special entries", async () => {
  const readEntries = jest
    .fn()
    .mockResolvedValueOnce([
      entry("nested", "directory"),
      entry("hook.sh", "file"),
      entry("link.sh", "link"),
    ])
    .mockResolvedValueOnce([entry("inner.sh", "file")]);
  await expect(
    scanTree("root", readEntries, (parent, name) => `${parent}/${name}`),
  ).resolves.toEqual([
    { file: "root/nested/inner.sh", name: "nested/inner.sh" },
    { file: "root/hook.sh", name: "hook.sh" },
  ]);
});

test.each([
  ["empty", []],
  ["null", null],
])("applies the %s missing-root policy", async (policy, result) => {
  const missing = Object.assign(new Error("missing"), { code: "ENOENT" });
  await expect(
    scanTree(
      "root",
      jest.fn().mockRejectedValue(missing),
      (parent, name) => `${parent}/${name}`,
      "",
      policy,
    ),
  ).resolves.toEqual(result);
});

test("propagates missing nested directories", async () => {
  const missing = Object.assign(new Error("nested directory disappeared"), { code: "ENOENT" });
  const readEntries = jest
    .fn()
    .mockResolvedValueOnce([entry("nested", "directory")])
    .mockRejectedValueOnce(missing);
  await expect(
    scanTree("root", readEntries, (parent, name) => `${parent}/${name}`, "", "empty"),
  ).rejects.toBe(missing);
});

test("applies the bundle policy to missing nested directories", async () => {
  const missing = Object.assign(new Error("nested directory disappeared"), { code: "ENOENT" });
  const readEntries = jest
    .fn()
    .mockResolvedValueOnce([entry("nested", "directory")])
    .mockRejectedValueOnce(missing);
  await expect(
    scanTree("root", readEntries, (parent, name) => `${parent}/${name}`, "", "empty", "empty"),
  ).resolves.toEqual([]);
});
