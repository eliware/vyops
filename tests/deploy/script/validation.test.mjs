import { jest } from "@jest/globals";
const { localScriptMetadata } = await import("../../../src/deploy/script/validation.mjs");

test("combines local script content and file metadata", async () => {
  const content = Buffer.from("notes\n");
  const readFile = jest.fn().mockResolvedValue(content);
  const stat = jest.fn().mockResolvedValue({ mode: 0o100640 });

  await expect(
    localScriptMetadata(readFile, stat, "/bundle/scripts", "notes.txt"),
  ).resolves.toEqual({
    content,
    mode: 0o640,
    executable: 0,
    binary: false,
    localHash: null,
  });
  expect(readFile).toHaveBeenCalledWith("/bundle/scripts/notes.txt");
  expect(stat).toHaveBeenCalledWith("/bundle/scripts/notes.txt");
});
