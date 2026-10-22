import { jest } from "@jest/globals";

const stat = jest.fn();
jest.unstable_mockModule("@eliware/common", () => ({ fs: { promises: { stat } } }));
const { readScriptMetadata } = await import("../../../src/deploy/script/local-metadata.mjs");

beforeEach(() => stat.mockReset());

test("reads local permissions and hashes binary script content", async () => {
  stat.mockResolvedValue({ mode: 0o100640 });
  const readFile = jest
    .fn()
    .mockResolvedValueOnce(Buffer.from("plain text"))
    .mockResolvedValueOnce(Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
  const textMetadata = await readScriptMetadata(readFile, "/bundle/scripts", "data.txt");
  expect(textMetadata).toMatchObject({
    mode: 0o640,
    executable: 0,
    binary: false,
    localHash: null,
  });

  const binaryMetadata = await readScriptMetadata(readFile, "/bundle/scripts", "helper.exe");
  expect(readFile).toHaveBeenNthCalledWith(2, "/bundle/scripts/helper.exe");
  expect(binaryMetadata).toMatchObject({ mode: 0o755, executable: 0o111, binary: true });
  expect(binaryMetadata.localHash).toMatch(/^[a-f0-9]{64}$/);
});
