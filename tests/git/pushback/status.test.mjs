import { hasStagedAndUnstagedChanges } from "../../../src/git/pushback/status.mjs";

test.each([
  ["MM config.boot\0", true],
  [" M config.boot\0", false],
  ["A  config.boot\0", false],
  ["?? config.boot\0", false],
  ["", false],
])("detects mixed index and worktree changes in %p", (status, expected) => {
  expect(hasStagedAndUnstagedChanges(status)).toBe(expected);
});
