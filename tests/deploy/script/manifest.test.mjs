import { jest } from "@jest/globals";

const { readDeploymentState, readManagedPaths } =
  await import("../../../src/deploy/script/manifest.mjs");

const header =
  "kind\tpath\tpreexisting\told_mode\told_sha256\told_type\tnew_mode\tnew_sha256\tnew_type";
const manifest = (name, preexisting = "false") =>
  `${header}\nfile\t${name}\t${preexisting}\t-\t-\t-\t755\thash\tregular file\n`;

test("reads and validates managed file paths", async () => {
  const readFile = jest.fn().mockResolvedValue(manifest("hook.sh"));
  await expect(readManagedPaths(readFile, "/tmp/manifest")).resolves.toEqual(new Set(["hook.sh"]));
});

test("reads directory records without treating directories as managed files", async () => {
  const content = `${header}\ndirectory\tnested\tfalse\t-\t-\tdirectory\t755\t-\tdirectory\n${manifest("nested/hook.sh").split("\n")[1]}\n`;
  await expect(
    readDeploymentState(jest.fn().mockResolvedValue(content), "/tmp/manifest"),
  ).resolves.toEqual({ managed: new Set(["nested/hook.sh"]), hasManifest: true });
});

test("reports whether a deployment manifest exists", async () => {
  await expect(
    readDeploymentState(jest.fn().mockResolvedValue(manifest("hook.sh")), "/tmp/manifest"),
  ).resolves.toEqual({ managed: new Set(["hook.sh"]), hasManifest: true });
  await expect(
    readDeploymentState(
      jest.fn().mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" })),
      "/tmp/manifest",
    ),
  ).resolves.toEqual({ managed: new Set(), hasManifest: false });
});

test("rejects unsafe manifest paths and tolerates a missing manifest", async () => {
  await expect(
    readManagedPaths(jest.fn().mockResolvedValue(manifest("../escape")), "/tmp/manifest"),
  ).rejects.toThrow("unsafe script path");
  await expect(
    readManagedPaths(
      jest.fn().mockRejectedValue(Object.assign(new Error("missing"), { code: "ENOENT" })),
      "/tmp/manifest",
    ),
  ).resolves.toEqual(new Set());
});

test.each([
  "file\thook.sh\tfalse\n",
  "kind\tpath\tpreexisting\told_mode\told_sha256\told_type\tnew_mode\tnew_sha256\tnew_type\nfile\thook.sh\tfalse\n",
  `${header}\nfile\thook.sh\tfalse\t-\t-\t-\t755\thash\tregular file\nfile\thook.sh\tfalse\t-\t-\t-\t755\thash\tregular file\n`,
])("rejects malformed deployment manifests", async (content) => {
  await expect(
    readManagedPaths(jest.fn().mockResolvedValue(content), "/tmp/manifest"),
  ).rejects.toThrow(/invalid header|malformed record|duplicate script path/);
});
