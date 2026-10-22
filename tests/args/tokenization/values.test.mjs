const { readCommandValues } = await import("../../../src/args/tokenization/values.mjs");

test("collects positional values and skips switches before the marker", () => {
  expect(readCommandValues(["release", "--force", "config.boot", "router"], 1, -1)).toEqual([
    "config.boot",
    "router",
  ]);
});

test("keeps switch-like values after the marker", () => {
  expect(readCommandValues(["preflight", "--", "--config.boot"], 1, 1)).toEqual(["--config.boot"]);
});
