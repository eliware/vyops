import { jest } from "@jest/globals";
import { EventEmitter } from "node:events";
jest.useFakeTimers();
const { attachInteractiveLifecycle } = await import("../../../src/ssh/interactive/lifecycle.mjs");

function options({
  commands = [],
  index = 0,
  currentItem,
  reject = jest.fn(),
  resolve = jest.fn(),
} = {}) {
  const stream = new EventEmitter();
  stream.stderr = new EventEmitter();
  stream.close = jest.fn();
  const state = {
    output: "output",
    response: "",
    index,
    currentItem,
    waiting: index > 0,
    answering: false,
    settled: false,
    timedOut: false,
  };
  const timer = setTimeout(() => {}, 60000);
  attachInteractiveLifecycle({
    stream,
    commands,
    log: jest.fn(),
    state,
    timer,
    resolve,
    reject,
  });
  return { stream, state, reject, resolve };
}

test("rejects stream errors and early closure", () => {
  const failed = options();
  failed.stream.emit("error", new Error("stream failed"));
  expect(failed.reject).toHaveBeenCalledWith(expect.objectContaining({ message: "stream failed" }));

  const closed = options({ commands: ["run"] });
  closed.stream.emit("close");
  expect(closed.reject).toHaveBeenCalledWith(
    expect.objectContaining({
      message: "interactive SSH closed before command sequence completed",
    }),
  );
});

test("records stderr failures and resolves an expected exit", () => {
  const failed = options({
    commands: [{ command: "save", reject: /save failed/i }],
    index: 1,
    currentItem: { command: "save", reject: /save failed/i },
  });
  failed.stream.stderr.emit("data", "save failed");
  expect(failed.reject).toHaveBeenCalledWith(
    expect.objectContaining({ message: "interactive command failed: save (save failed)" }),
  );

  const exited = options({ commands: ["exit"], index: 1, resolve: jest.fn() });
  exited.stream.emit("close");
  expect(exited.resolve).toHaveBeenCalledWith("output");
});

test("rejects shell closure when exit is queued but not sent", () => {
  const closed = options({ commands: ["save", "exit"], index: 1 });
  closed.stream.emit("close");
  expect(closed.reject).toHaveBeenCalledWith(
    expect.objectContaining({
      message: "interactive SSH closed before command sequence completed",
    }),
  );
  expect(closed.resolve).not.toHaveBeenCalled();
});
