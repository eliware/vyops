const { scanConfigLine } = await import("../../src/validate/scan-config-line.mjs");

test("scans comments and braces outside quoted text", () => {
  expect(scanConfigLine('value "# { }" { # note', 4)).toEqual({
    code: 'value "# { }" { ',
    opening: 14,
    closing: -1,
  });
});

test("keeps escaped quotes and comment markers inside quoted text", () => {
  const value = 'value "escaped ' + "\\" + '" # { still" {';
  expect(scanConfigLine(value, 1)).toMatchObject({ opening: value.length - 1, closing: -1 });
});

test.each([
  ['value "unfinished', "unterminated quotation mark"],
  ["value { {", "multiple opening braces"],
  ["value } }", "multiple closing braces"],
])("rejects invalid lexical line %s", (value, message) => {
  expect(() => scanConfigLine(value, 2)).toThrow(`line 2: ${message}`);
});
