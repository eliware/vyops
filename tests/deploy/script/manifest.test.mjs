import { jest } from "@jest/globals";

const { readDeploymentState } = await import("../../../src/deploy/script/manifest.mjs");

const header =
  "kind\tpath\tpreexisting\told_mode\told_sha256\told_type\tnew_mode\tnew_sha256\tnew_type";
const manifest = (name, preexisting = "false") =>
  `${header}\nfile\t${name}\t${preexisting}\t-\t-\t-\t755\thash\tregular file\n`;

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

test("propagates invalid manifest content", async () => {
  await expect(
    readDeploymentState(jest.fn().mockResolvedValue("invalid header\n"), "/tmp/manifest"),
  ).rejects.toThrow("deployment manifest has an invalid header");
});
