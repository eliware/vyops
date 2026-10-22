import { scriptSyncDependencies } from "../../../src/deploy/script/transaction-dependencies.mjs";

test("provides the dependencies for a script synchronization transaction", () => {
  const dependencies = scriptSyncDependencies();
  expect(dependencies).toMatchObject({
    exec: expect.any(Function),
    stageScript: expect.any(Function),
    installStagedScripts: expect.any(Function),
    rollbackScripts: expect.any(Function),
    log: expect.any(Object),
    readLocalFile: expect.any(Function),
    stat: expect.any(Function),
    eliwarePath: expect.any(Function),
  });
});
