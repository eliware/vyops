import { validateConfigLine } from "../../src/validate/line.mjs";

test("validates a statement and a closing brace at matching depth", () => {
  expect(validateConfigLine("system {", 0, 1)).toEqual({ depth: 1, hasStatement: true });
  expect(validateConfigLine("}", 1, 2)).toEqual({ depth: 0, hasStatement: true });
  expect(validateConfigLine(" # comment", 0, 3)).toEqual({ depth: 0, hasStatement: false });
});

test("rejects invalid line syntax", () => {
  expect(() => validateConfigLine("    }", 0, 1)).toThrow("unexpected closing brace");
  expect(() => validateConfigLine("system { extra", 0, 1)).toThrow("opening brace must end");
});
