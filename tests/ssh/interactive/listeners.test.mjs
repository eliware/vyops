import { jest } from "@jest/globals";
import { EventEmitter } from "node:events";
jest.useFakeTimers();
const { attachInteractiveListeners } = await import("../../../src/ssh/interactive/listeners.mjs");

test("wires stream data and lifecycle events", () => {
  const stream = new EventEmitter();
  stream.stderr = new EventEmitter();
  const timer = setTimeout(() => {}, 60000);
  attachInteractiveListeners({
    stream,
    client: {},
    commands: [],
    log: jest.fn(),
    state: {
      output: "",
      response: "",
      index: 0,
      waiting: false,
      answering: false,
      settled: false,
      timedOut: false,
    },
    timer,
    sendNext: jest.fn(),
    resolve: jest.fn(),
    reject: jest.fn(),
    onCommandComplete: jest.fn(),
  });
  expect(stream.listenerCount("data")).toBe(1);
  expect(stream.listenerCount("error")).toBe(1);
  expect(stream.listenerCount("close")).toBe(1);
  expect(stream.stderr.listenerCount("data")).toBe(1);
  clearTimeout(timer);
});
