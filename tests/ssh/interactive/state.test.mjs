import { createInteractiveState } from "../../../src/ssh/interactive/state.mjs";

test("creates the initial shell interaction state", () => {
  expect(createInteractiveState()).toEqual({
    output: "",
    response: "",
    index: 0,
    waiting: false,
    answering: false,
    settled: false,
    timedOut: false,
    currentItem: undefined,
  });
});
