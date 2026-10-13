import { isSafeScriptPath, validateScriptPath } from "../../src/bundle/script-path-rules.mjs";

test.each(["scripts/@group/hook.sh", "scripts/hook-1.sh", "hook.name"])(
  "accepts safe script paths: %s",
  (name) => expect(isSafeScriptPath(name)).toBe(true),
);

test.each(["/etc/passwd", "../escape", "a//b", "a/./b", "a/../b", "bad name"])(
  "rejects unsafe script paths: %s",
  (name) => expect(isSafeScriptPath(name)).toBe(false),
);

test("rejects an unsafe script path with a preflight error", () => {
  expect(() => validateScriptPath("../escape")).toThrow(
    "preflight failed: scripts/../escape path is invalid",
  );
});
