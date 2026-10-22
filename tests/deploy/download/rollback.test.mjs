import { jest } from "@jest/globals";
import { rollbackDownloadedFiles } from "../../../src/deploy/download/rollback.mjs";

test("removes installed files and restores saved files in reverse order", async () => {
  const calls = [];
  const fs = {
    rm: jest.fn(async (path) => calls.push(["rm", path])),
    rename: jest.fn(async (source, target) => calls.push(["rename", source, target])),
  };
  await rollbackDownloadedFiles(
    fs,
    [{ local: "new-1" }, { local: "new-2" }],
    [
      { previous: "old-1", local: "file-1" },
      { previous: "old-2", local: "file-2" },
    ],
  );
  expect(calls).toEqual([
    ["rm", "new-2"],
    ["rm", "new-1"],
    ["rename", "old-2", "file-2"],
    ["rename", "old-1", "file-1"],
  ]);
});
