import { jest } from "@jest/globals";
import { readManagedPaths } from "../../../src/deploy/script/managed-paths.mjs";

const header =
  "kind\tpath\tpreexisting\told_mode\told_sha256\told_type\tnew_mode\tnew_sha256\tnew_type";
const manifest = (name) => `${header}\nfile\t${name}\tfalse\t-\t-\t-\t755\thash\tregular file\n`;

test("returns managed paths from a valid deployment manifest", async () => {
  await expect(
    readManagedPaths(jest.fn().mockResolvedValue(manifest("hook.sh")), "/tmp/manifest"),
  ).resolves.toEqual(new Set(["hook.sh"]));
});

test("rejects unsafe manifest paths", async () => {
  await expect(
    readManagedPaths(jest.fn().mockResolvedValue(manifest("../escape")), "/tmp/manifest"),
  ).rejects.toThrow("unsafe script path");
});

test("returns an empty set when the deployment manifest does not exist", async () => {
  const missing = Object.assign(new Error("missing"), { code: "ENOENT" });
  await expect(
    readManagedPaths(jest.fn().mockRejectedValue(missing), "/tmp/manifest"),
  ).resolves.toEqual(new Set());
});
