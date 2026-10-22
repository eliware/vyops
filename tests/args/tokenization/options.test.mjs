const { readCommandOptions } = await import("../../../src/args/tokenization/options.mjs");

test("collects switches before and after the command", () => {
  expect(readCommandOptions(["--debug", "release", "--force"], -1)).toEqual(
    new Set(["--debug", "--force"]),
  );
});

test("stops collecting switches at the positional value marker", () => {
  expect(readCommandOptions(["--debug", "release", "--force", "--", "--raw"], 3)).toEqual(
    new Set(["--debug", "--force"]),
  );
});
