import { jest } from "@jest/globals";
import { createInteractiveShellErrorHandler } from "../../../src/ssh/interactive/shell-lifecycle.mjs";

test("settles the command and clears its timer when shell creation fails", () => {
  const state = { settled: false };
  const timer = {};
  const reject = jest.fn();
  const clear = jest.spyOn(globalThis, "clearTimeout");
  const handleError = createInteractiveShellErrorHandler({ state, timer, reject });
  const error = new Error("shell unavailable");
  handleError(error);
  expect(state.settled).toBe(true);
  expect(clear).toHaveBeenCalledWith(timer);
  expect(reject).toHaveBeenCalledWith(error);
  handleError(new Error("late shell error"));
  expect(reject).toHaveBeenCalledTimes(1);
  clear.mockRestore();
});
