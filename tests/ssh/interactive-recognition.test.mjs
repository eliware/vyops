import {
  isRouterPrompt,
  isPagerPrompt,
  isCommitPrompt,
} from "../../src/ssh/interactive-recognition.mjs";

test("recognizes router, pager, and commit prompts", () => {
  expect(isRouterPrompt("router@vyos#")).toBe(true);
  expect(isRouterPrompt("testuser@test-router.example.test# ")).toBe(true);
  expect(isRouterPrompt("ordinary output")).toBe(false);
  expect(isPagerPrompt("--More--")).toEqual({ found: true, returnPager: false });
  expect(isPagerPrompt("No next tag (press RETURN)")).toEqual({
    found: true,
    returnPager: true,
  });
  expect(isPagerPrompt("ordinary output")).toEqual({ found: false, returnPager: false });
  expect(isCommitPrompt("Proceed? [Y/n]")).toBe(true);
  expect(isCommitPrompt("ordinary output")).toBe(false);
});
