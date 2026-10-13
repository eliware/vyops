import { validateCommandOptions } from "../src/args-validation.mjs";
import { usage } from "../src/cli/usage.mjs";

test("applies option and positional rules to each command", () => {
  expect(() => validateCommandOptions("preflight", new Set(["--debug"]), 1, usage)).not.toThrow();
  expect(() => validateCommandOptions("backup", new Set(), 2, usage)).not.toThrow();
  expect(() => validateCommandOptions("release", new Set(["--yes"]), 1, usage)).not.toThrow();
  expect(() => validateCommandOptions("backup", new Set(), 1, usage)).toThrow(usage);
});
