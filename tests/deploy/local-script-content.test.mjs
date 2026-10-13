import { jest } from "@jest/globals";
import { readLocalScriptContent } from "../../src/deploy/local-script-content.mjs";

test("reads local script content", async () => {
  const readFile = jest.fn().mockResolvedValue(Buffer.from("script"));
  await expect(readLocalScriptContent(readFile, "/bundle/scripts/hook.sh")).resolves.toEqual(
    Buffer.from("script"),
  );
  expect(readFile).toHaveBeenCalledWith("/bundle/scripts/hook.sh");
});

test("uses empty content when a local script is absent", async () => {
  const error = Object.assign(new Error("missing"), { code: "ENOENT" });
  await expect(
    readLocalScriptContent(jest.fn().mockRejectedValue(error), "/missing"),
  ).resolves.toEqual(Buffer.alloc(0));
});

test("propagates local read failures other than missing files", async () => {
  const error = new Error("read failed");
  await expect(readLocalScriptContent(jest.fn().mockRejectedValue(error), "/broken")).rejects.toBe(
    error,
  );
});
