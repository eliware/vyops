import { lexConfigLine } from "../../src/config/lexer.mjs";

test("keeps quoted syntax and excludes comments", () => {
  expect(lexConfigLine('value "# { }" { # note')).toEqual({
    code: 'value "# { }" { ',
    braces: [{ character: "{", index: 14 }],
    quote: null,
    unterminatedQuote: false,
  });
});

test("ignores escaped quote characters inside quoted text", () => {
  const line = 'value "escaped ' + String.fromCharCode(92) + '" # { still" }';
  expect(lexConfigLine(line)).toMatchObject({
    braces: [{ character: "}", index: line.length - 1 }],
    unterminatedQuote: false,
  });
});

test("reports an unfinished quoted value", () => {
  expect(lexConfigLine('value "unfinished')).toMatchObject({ unterminatedQuote: true });
});

test("carries a quoted value across lines when requested", () => {
  expect(lexConfigLine('text }"', '"')).toMatchObject({
    braces: [],
    quote: null,
    unterminatedQuote: false,
  });
});
