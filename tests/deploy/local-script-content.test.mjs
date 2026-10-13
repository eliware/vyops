import { jest } from "@jest/globals";
import { readLocalScriptContent } from "../../src/deploy/local-script-content.mjs";

test("reads local script content", async () => {
  const readFile = jest.fn().mockResolvedValue(Buffer.from("script"));
  await expect(readLocalScriptContent(readFile, "/bundle/scripts/hook.sh")).resolves.toEqual(
    Buffer.from("script"),
  );
  expect(readFile).toHaveBeenCalledWith("/bundle/scripts/hook.sh");
});

test("rejects when a discovered local script is absent", async () => {
  const error = Object.assign(new Error("missing"), { code: "ENOENT" });
  await expect(readLocalScriptContent(jest.fn().mockRejectedValue(error), "/missing")).rejects.toBe(
    error,
  );
});

test("propagates local read failures other than missing files", async () => {
  const error = new Error("read failed");
  await expect(readLocalScriptContent(jest.fn().mockRejectedValue(error), "/broken")).rejects.toBe(
    error,
  );
});
