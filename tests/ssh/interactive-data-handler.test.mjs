import { jest } from "@jest/globals";
import { handleInteractiveData } from "../../src/ssh/interactive-data-handler.mjs";

function createOptions(overrides = {}) {
  const options = {
    commands: ["show version"],
    log: jest.fn(),
    state: {
      output: "",
      response: "",
      index: 1,
      waiting: true,
      answering: false,
      settled: false,
      timedOut: false,
      currentItem: "show version",
    },
    stream: { close: jest.fn(), end: jest.fn(), write: jest.fn() },
    timer: 0,
    sendNext: jest.fn(),
    resolve: jest.fn(),
    reject: jest.fn(),
    onCommandComplete: jest.fn(),
    ...overrides,
  };
  return options;
}

test("collects output and completes a command at the router prompt", () => {
  const options = createOptions();
  handleInteractiveData("vyos@router#", options);
  expect(options.state).toMatchObject({
    output: "vyos@router#",
    response: "vyos@router#",
    settled: true,
  });
  expect(options.onCommandComplete).toHaveBeenCalledWith("show version");
  expect(options.stream.end).toHaveBeenCalled();
  expect(options.resolve).toHaveBeenCalledWith("vyos@router#");
});

test("answers pager prompts and holds the command open", () => {
  const options = createOptions();
  handleInteractiveData("--More--", options);
  expect(options.stream.write).toHaveBeenCalledWith(" ");
  expect(options.resolve).not.toHaveBeenCalled();
});

test("collects ordinary output while a command remains active", () => {
  const options = createOptions();
  handleInteractiveData("partial response", options);
  expect(options.state).toMatchObject({ output: "partial response", response: "partial response" });
  expect(options.resolve).not.toHaveBeenCalled();
});

test("rejects a command when its failure pattern matches", () => {
  const options = createOptions({
    state: {
      output: "",
      response: "",
      index: 1,
      waiting: true,
      answering: false,
      settled: false,
      timedOut: false,
      currentItem: { command: "commit", reject: /commit failed/ },
    },
  });
  handleInteractiveData("commit failed", options);
  expect(options.state.settled).toBe(true);
  expect(options.stream.close).toHaveBeenCalled();
  expect(options.reject).toHaveBeenCalledWith(
    expect.objectContaining({ message: expect.stringContaining("commit failed") }),
  );
});

test.each([
  ["settled", { settled: true, timedOut: false }],
  ["timed out", { settled: false, timedOut: true }],
])("ignores data after the command is %s", (_label, state) => {
  const options = createOptions();
  Object.assign(options.state, state);
  handleInteractiveData("ignored", options);
  expect(options.state.output).toBe("");
});
