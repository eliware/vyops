import { commandSummary } from "../../src/ssh/command-summary.mjs";

test("normalizes and bounds command summaries", () => {
  expect(commandSummary("  show\n version  ")).toBe("show version");
  expect(commandSummary("x".repeat(300))).toHaveLength(240);
});
