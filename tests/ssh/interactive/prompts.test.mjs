import { jest } from "@jest/globals";
const { answerInteractivePrompt } = await import("../../../src/ssh/interactive/prompts.mjs");

test.each([
  ["No next tag (press RETURN)", "\n"],
  [":", " "],
  ["--More--", " "],
])("answers pager prompt %s", (cleaned, key) => {
  const stream = { write: jest.fn() };
  expect(answerInteractivePrompt({ cleaned, state: {}, stream, log: jest.fn() })).toBe(true);
  expect(stream.write).toHaveBeenCalledWith(key);
});

test("answers a commit prompt once", () => {
  const state = { answering: false, response: "output" };
  const stream = { write: jest.fn() };
  expect(
    answerInteractivePrompt({ cleaned: "Proceed? [Y/n]", state, stream, log: jest.fn() }),
  ).toBe(true);
  expect(state).toMatchObject({ answering: true, response: "" });
  expect(stream.write).toHaveBeenCalledWith("yes\n");
  expect(
    answerInteractivePrompt({ cleaned: "Proceed? [Y/n]", state, stream, log: jest.fn() }),
  ).toBe(false);
});

test("leaves ordinary output for command completion", () => {
  expect(
    answerInteractivePrompt({
      cleaned: "router#",
      state: { answering: false },
      stream: { write: jest.fn() },
      log: jest.fn(),
    }),
  ).toBe(false);
});
