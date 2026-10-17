const { shellQuote } = await import("../../src/backup/shell-quote.mjs");

test("quotes a value for a remote shell", () => {
  expect(shellQuote("/tmp/path")).toBe("'/tmp/path'");
  expect(shellQuote("router's file")).toBe("'router'\\''s file'");
});
