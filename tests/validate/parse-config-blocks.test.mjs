import { parseConfigBlocks } from "../../src/validate/parse-config-blocks.mjs";

test("parses comments, blank lines, statements, and nested blocks", () => {
  expect(parseConfigBlocks("# note\nsystem {\n    host-name router\n}\n")).toEqual([
    { type: "comment", value: "# note" },
    {
      type: "block",
      key: "system {",
      children: [{ type: "statement", value: "host-name router" }],
    },
    { type: "blank" },
  ]);
});

test("rejects missing and extra closing braces", () => {
  expect(() => parseConfigBlocks("system {\n host-name router")).toThrow(/unbalanced braces/);
  expect(() => parseConfigBlocks("system {\n}\n}")).toThrow(/unexpected closing brace/);
});
