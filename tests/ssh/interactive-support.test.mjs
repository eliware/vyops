import {
  cleanInteractiveText,
  interactiveFailureDetail,
  isRouterPrompt,
  isPagerPrompt,
  isCommitPrompt,
} from "../../src/ssh/interactive-support.mjs";

test("cleans terminal text and detects prompts", () => {
  expect(cleanInteractiveText("\u001b[31mfailed\u001b[0m\r")).toBe("failed");
  expect(isRouterPrompt("router@vyos#")).toBe(true);
  expect(isPagerPrompt("--More--").found).toBe(true);
  expect(isCommitPrompt("Proceed? [Y/n]")).toBe(true);
});

test("keeps bounded failure detail and redacts key values", () => {
  expect(interactiveFailureDetail('failed private key "secret"')).toBe(
    'failed private key "[redacted]"',
  );
});
