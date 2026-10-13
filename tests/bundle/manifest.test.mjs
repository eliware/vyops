import { jest } from "@jest/globals";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { validateScriptManifest } from "../../src/bundle/manifest.mjs";

test("reads file paths from the manifest", async () => {
  const readFile = jest
    .fn()
    .mockResolvedValue("kind\tpath\nfile\t@group/hook.sh\nfile\tbin/tool\n");
  await expect(validateScriptManifest("config.boot", readFile)).resolves.toEqual(
    new Set(["@group/hook.sh", "bin/tool"]),
  );
});

test("accepts valid preexisting values in the optional column", async () => {
  await expect(
    validateScriptManifest(
      "config.boot",
      async () => "kind\tpath\tpreexisting\nfile\thook.sh\ttrue\nfile\tother.sh\tfalse\n",
    ),
  ).resolves.toEqual(new Set(["hook.sh", "other.sh"]));
});

test("returns an empty set when the manifest is absent", async () => {
  const error = Object.assign(new Error("missing"), { code: "ENOENT" });
  await expect(
    validateScriptManifest("config.boot", async () => {
      throw error;
    }),
  ).resolves.toEqual(new Set());
});

test("uses the file reader default when the manifest is absent", async () => {
  await expect(validateScriptManifest(join(tmpdir(), `vyops-${randomUUID()}`))).resolves.toEqual(
    new Set(),
  );
});

test("propagates manifest read errors", async () => {
  const error = new Error("read failed");
  await expect(
    validateScriptManifest("config.boot", async () => {
      throw error;
    }),
  ).rejects.toBe(error);
});

test("rejects unsafe manifest paths", async () => {
  const readFile = async () => "kind\tpath\nfile\t../escape\n";
  await expect(validateScriptManifest("config.boot", readFile)).rejects.toThrow(
    "unsafe script path",
  );
});

test("rejects manifest paths that are absent from the script tree", async () => {
  await expect(
    validateScriptManifest("config.boot", async () => "kind\tpath\nfile\tstale.sh\n", ["live.sh"]),
  ).rejects.toThrow("manifest names a missing script file");
});

test.each([
  ["missing header", "file\thook.sh\n"],
  ["malformed record", "kind\tpath\nfile\n"],
  ["duplicate path", "kind\tpath\nfile\thook.sh\nfile\thook.sh\n"],
  ["invalid preexisting value", "kind\tpath\tpreexisting\nfile\thook.sh\tperhaps\n"],
  ["missing preexisting value", "kind\tpath\tpreexisting\nfile\thook.sh\n"],
])("rejects a manifest with %s", async (_label, content) => {
  await expect(validateScriptManifest("config.boot", async () => content)).rejects.toThrow(
    "deployment manifest",
  );
});
