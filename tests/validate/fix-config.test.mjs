import { fixConfig } from "../../src/validate/fix-config.mjs";
import { validateConfig } from "../../src/validate.mjs";

test("fixes ordering, whitespace, indentation, and line endings", async () => {
  expect(
    fixConfig("system {\r\n host-name router  \r\n banner hello\r\n address 192.0.2.1\r\n}\r\n"),
  ).toBe(`system {
    host-name router
    banner hello
    address 192.0.2.1
}
`);
});

test.each([
  ["misindented closing brace", "system {\n    host-name router\n  }"],
  ["extra closing brace", "system {\n}\n}"],
])("rejects %s", (_, config) => {
  expect(() => validateConfig(config)).toThrow(/config validation failed/);
});

test("fixConfig rejects unbalanced or extra braces without truncating", () => {
  expect(() => fixConfig("system {\n  host-name router")).toThrow(/unbalanced braces/);
  expect(() => fixConfig("system {\n}\n}\nother value")).toThrow(/unexpected closing brace/);
});

test("covers natural ordering comparisons and nested formatting", () => {
  expect(
    fixConfig(
      `zeta value\nalpha value\nfoo 10\nfoo 2\nfoo 1\nfoo\nfoo bar\nparent {\n  child 2\n}\nparent {\n  child 1\n}\n`,
    ),
  ).toBe(
    `zeta value\nalpha value\nfoo 10\nfoo 2\nfoo 1\nfoo\nfoo bar\nparent {\n    child 2\n}\nparent {\n    child 1\n}\n`,
  );
});

test("handles blank lines, comments, escaped quotes, and header comments", () => {
  expect(
    fixConfig(`// generated\n\n# comment\n system {\n  value "escaped \\" quote" # inline\n }\n\n`),
  ).toBe(`# comment\nsystem {\n    value "escaped \\" quote" # inline\n}\n\n\n// generated\n`);
  expect(() => validateConfig('system {\n    value "escaped \\\" quote"\n}')).not.toThrow();
});

test("sorts consecutive block headers through all natural comparison paths", () => {
  expect(
    fixConfig(
      `foo bar {\n}\nfoo {\n}\nfoo 10 {\n}\nfoo 2 {\n}\na b c {\n}\na b {\n}\nalpha {\n}\nbeta {\n}\n`,
    ),
  ).toContain("foo {");
});

test("fixConfig rejects an unmatched top-level closing brace", () => {
  expect(() => fixConfig("}")).toThrow(/unexpected closing brace/);
});
