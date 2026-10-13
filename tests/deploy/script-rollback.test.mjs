import { jest } from "@jest/globals";
import { rollbackScripts } from "../../src/deploy/script-rollback.mjs";

test("rolls back managed script paths and warns on failure", async () => {
  const exec = jest.fn().mockRejectedValue(new Error("transport lost"));
  const log = { warn: jest.fn() };
  await rollbackScripts(exec, log, {
    client: {},
    manifest: "/tmp/m.tsv",
    installDir: "/config/scripts",
    backupDir: "/tmp/b",
    remoteDir: "/tmp/r",
  });
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("script rollback failed"));
});
