import { jest } from "@jest/globals";
import { isStaleOwner } from "../../../src/git/lock/stale-owner.mjs";

test.each([
  ["live process", undefined, false],
  ["permission denied", "EPERM", false],
  ["unknown process error", "EINVAL", false],
  ["exited process", "ESRCH", true],
])("checks whether the owner process is stale: %s", (_label, code, expected) => {
  const kill = jest.spyOn(process, "kill").mockImplementation(() => {
    if (code) throw Object.assign(new Error(code), { code });
  });
  try {
    expect(isStaleOwner(424242)).toBe(expected);
  } finally {
    kill.mockRestore();
  }
});
