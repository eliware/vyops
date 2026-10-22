import { cleanInteractiveText } from "../../../src/ssh/interactive/text.mjs";

test("cleans terminal escape sequences and carriage returns", () => {
  expect(cleanInteractiveText("\u001b[31mfailed\u001b[0m\r")).toBe("failed");
});
