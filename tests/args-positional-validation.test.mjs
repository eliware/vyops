import { validateCommandPositionals } from "../src/args-positional-validation.mjs";
import { usage } from "../src/cli/usage.mjs";

test.each([
  ["preflight", 1],
  ["backup", 2],
  ["release", 1],
])("accepts the expected number of %s values", (command, valueCount) => {
  expect(() => validateCommandPositionals(command, valueCount, usage)).not.toThrow();
});

test.each([
  ["preflight", 0],
  ["backup", 1],
  ["release", 2],
])("rejects the wrong number of %s values", (command, valueCount) => {
  expect(() => validateCommandPositionals(command, valueCount, usage)).toThrow(usage);
});
