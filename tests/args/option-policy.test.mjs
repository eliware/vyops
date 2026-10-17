const { validateCommandOptionPolicy } = await import("../../src/args/option-policy.mjs");
const { usage } = await import("../../src/cli/usage.mjs");

test.each([
  ["preflight", new Set(["--debug"])],
  ["backup", new Set(["--password-stdin"])],
  ["release", new Set(["--yes", "--no-hooks", "--force"])],
])("accepts valid %s options", (command, options) => {
  expect(() => validateCommandOptionPolicy(command, options, usage)).not.toThrow();
});

test.each([
  ["preflight", new Set(["--force"])],
  ["preflight", new Set(["--password-stdin"])],
  ["release", new Set()],
  ["release", new Set(["--yes", "--no-hooks"])],
])("rejects invalid %s options", (command, options) => {
  expect(() => validateCommandOptionPolicy(command, options, usage)).toThrow(usage);
});
