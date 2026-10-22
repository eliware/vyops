import { naturalCompare } from "../../src/validate/natural-compare.mjs";

test.each([
  ["item2", "item10", -8],
  ["item", "item2", -1],
  ["item2", "item", 1],
  ["alpha", "beta", -1],
  ["same", "same", 0],
])("compares %s with %s", (left, right, result) => {
  expect(naturalCompare(left, right)).toBe(result);
});
