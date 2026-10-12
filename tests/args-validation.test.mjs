import { validateCommandOptions } from "../src/args-validation.mjs";
import { usage } from "../src/args.mjs";

test("accepts command option policies", () => {
  expect(() => validateCommandOptions("preflight", new Set(["--debug"]), 1, usage)).not.toThrow();
  expect(() =>
    validateCommandOptions("backup", new Set(["--password-stdin"]), 2, usage),
  ).not.toThrow();
  expect(() =>
    validateCommandOptions("release", new Set(["--yes", "--no-hooks", "--force"]), 1, usage),
  ).not.toThrow();
});

test.each([
  ["preflight", new Set(["--force"]), 1],
  ["backup", new Set(), 1],
  ["release", new Set(), 1],
  ["release", new Set(["--yes", "--no-hooks"]), 1],
  ["release", new Set(["--yes"]), 2],
])("rejects invalid command options", (command, options, valueCount) => {
  expect(() => validateCommandOptions(command, options, valueCount, usage)).toThrow(/Usage:/);
});
