import { jest } from "@jest/globals";
import { installStagedScripts } from "../../../src/deploy/script/install.mjs";

test("does not run installation commands for an empty stage", async () => {
  const exec = jest.fn();
  await installStagedScripts({ staged: [], client: {}, exec, debugLog: jest.fn() });
  expect(exec).not.toHaveBeenCalled();
});
