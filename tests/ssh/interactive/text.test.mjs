const { cleanInteractiveText, interactiveFailureDetail } =
  await import("../../../src/ssh/interactive/text.mjs");

test("cleans terminal escape sequences and carriage returns", () => {
  expect(cleanInteractiveText("\u001b[31mfailed\u001b[0m\r")).toBe("failed");
});

test("keeps bounded failure detail and redacts key values", () => {
  expect(interactiveFailureDetail('failed private key "secret"')).toBe(
    'failed private key "[redacted]"',
  );
  expect(interactiveFailureDetail("ordinary output")).toBeUndefined();
  expect(interactiveFailureDetail(`error ${"x".repeat(300)}`)).toHaveLength(240);
});
