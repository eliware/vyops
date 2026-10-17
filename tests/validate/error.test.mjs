const { fail } = await import("../../src/validate/error.mjs");

test("formats a config validation error with its line number", () => {
  expect(() => fail(7, "invalid brace")).toThrow(
    "config validation failed at line 7: invalid brace",
  );
});
