import { findConfigBlockOpening } from "../../../src/bundle/config-block/lookup.mjs";

test("finds the opening brace for a declaration", () => {
  expect(findConfigBlockOpening("interfaces {}\nsystem {\n}", "system")).toBe(21);
});

test("ignores a declaration that has no code brace", () => {
  expect(findConfigBlockOpening('system "quoted { value"', "system")).toBe(-1);
});
