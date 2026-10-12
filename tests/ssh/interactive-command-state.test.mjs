import { jest } from "@jest/globals";
import {
  completeInteractiveCommand,
  rejectInteractiveCommand,
} from "../../src/ssh/interactive-command-state.mjs";

test("rejects a structured command failure and closes the stream", () => {
  const state = {
    waiting: true,
    settled: false,
    currentItem: { command: "load config", reject: /invalid/i },
  };
  const stream = { close: jest.fn() };
  const reject = jest.fn();
  expect(
    rejectInteractiveCommand({ state, stream, timer: undefined, reject, cleaned: "invalid" }),
  ).toBe(true);
  expect(state.settled).toBe(true);
  expect(stream.close).toHaveBeenCalled();
  expect(reject).toHaveBeenCalledWith(
    new Error("interactive command failed: load config (invalid)"),
  );
});

test("ignores unmatched or unstructured command failures", () => {
  const reject = jest.fn();
  expect(
    rejectInteractiveCommand({
      state: { waiting: false, currentItem: { command: "load", reject: /invalid/ } },
      stream: { close: jest.fn() },
      timer: undefined,
      reject,
      cleaned: "invalid",
    }),
  ).toBe(false);
  expect(
    rejectInteractiveCommand({
      state: { waiting: true, currentItem: "show version" },
      stream: { close: jest.fn() },
      timer: undefined,
      reject,
      cleaned: "invalid",
    }),
  ).toBe(false);
  expect(
    rejectInteractiveCommand({
      state: { waiting: true, currentItem: { command: "load", reject: /invalid/ } },
      stream: { close: jest.fn() },
      timer: undefined,
      reject,
      cleaned: "valid",
    }),
  ).toBe(false);
  expect(reject).not.toHaveBeenCalled();
});

test("completes the last command and closes the stream", () => {
  const state = {
    waiting: true,
    answering: true,
    index: 1,
    output: "router#",
    currentItem: "show",
  };
  const stream = { end: jest.fn() };
  const resolve = jest.fn();
  const onCommandComplete = jest.fn();
  expect(
    completeInteractiveCommand({
      state,
      commands: ["show"],
      stream,
      timer: undefined,
      sendNext: jest.fn(),
      resolve,
      onCommandComplete,
    }),
  ).toBe(true);
  expect(state).toMatchObject({ settled: true, waiting: false, answering: false });
  expect(stream.end).toHaveBeenCalled();
  expect(resolve).toHaveBeenCalledWith("router#");
  expect(onCommandComplete).toHaveBeenCalledWith("show");
});

test("sends the next command when work remains", () => {
  const state = {
    waiting: true,
    answering: true,
    index: 1,
    output: "",
    currentItem: { command: "first" },
  };
  const sendNext = jest.fn();
  const completed = jest.fn();
  completeInteractiveCommand({
    state,
    commands: ["first", "second"],
    stream: { end: jest.fn() },
    timer: undefined,
    sendNext,
    resolve: jest.fn(),
    onCommandComplete: completed,
  });
  expect(state).toMatchObject({ waiting: false, answering: false });
  expect(completed).toHaveBeenCalledWith("first");
  expect(sendNext).toHaveBeenCalled();
});

test("does not complete a command that is not waiting", () => {
  expect(
    completeInteractiveCommand({
      state: { waiting: false },
      commands: [],
      stream: { end: jest.fn() },
      timer: undefined,
      sendNext: jest.fn(),
      resolve: jest.fn(),
      onCommandComplete: jest.fn(),
    }),
  ).toBe(false);
});
