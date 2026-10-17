import { jest } from "@jest/globals";
const { localScriptMetadataForContent } =
  await import("../../../src/deploy/local-script/metadata.mjs");

test("derives executable metadata from a shebang", async () => {
  await expect(
    localScriptMetadataForContent(Buffer.from("#!/bin/sh\n"), jest.fn(), "/hook", "hook.sh"),
  ).resolves.toMatchObject({ mode: 0o755, executable: 0o111, binary: false, localHash: null });
});

test("uses existing mode for non-executable files", async () => {
  await expect(
    localScriptMetadataForContent(
      Buffer.from("notes\n"),
      jest.fn().mockResolvedValue({ mode: 0o100640 }),
      "/notes",
      "notes.txt",
    ),
  ).resolves.toMatchObject({ mode: 0o640, executable: 0, binary: false, localHash: null });
});

test("hashes binary script content", async () => {
  const metadata = await localScriptMetadataForContent(
    Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
    jest.fn(),
    "/binary",
    "helper.exe",
  );
  expect(metadata).toMatchObject({ mode: 0o755, executable: 0o111, binary: true });
  expect(metadata.localHash).toMatch(/^[a-f0-9]{64}$/);
});
