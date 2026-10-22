import { extractConfigBlock } from "../../../src/bundle/config-block/extract.mjs";

test("extracts nested contents and ignores braces in quoted text", () => {
  const source = 'system {\n note "quoted } brace"\n login {\n }\n}';
  expect(extractConfigBlock(source, 7)).toContain('note "quoted } brace"');
});

test("returns empty text when the opening brace is absent or incomplete", () => {
  expect(extractConfigBlock("system {}", -1)).toBe("");
  expect(extractConfigBlock("system {\n login {\n", 7)).toBe("");
});
