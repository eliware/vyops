import { parse, resolve } from "node:path";
const { backupDestination } = await import("../../src/backup/destination.mjs");

test("resolves a backup destination", () => {
  expect(backupDestination("backup/config")).toBe(resolve("backup/config"));
});

test("rejects a filesystem root", () => {
  const root = parse(resolve(".")).root;
  expect(() => backupDestination(root)).toThrow("backup destination must not be a filesystem root");
});
