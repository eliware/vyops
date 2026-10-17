import { jest } from "@jest/globals";
import { EventEmitter } from "node:events";
jest.useFakeTimers();
const { attachInteractiveListeners } = await import("../../../src/ssh/interactive/listeners.mjs");
const { interactive } = await import("../../../src/ssh/interactive.mjs");
const { MockClient } = await import("../../../test-fixtures/ssh-client.mjs");

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

test("completes a structured command", async () => {
  const client = new MockClient();
  const completed = jest.fn();
  const promise = interactive(client, [{ phase: "save", command: "save" }], jest.fn(), completed);
  await Promise.resolve();
  client.shellStream.emit("data", "\ntestuser@test-router.example.test# ");
  await expect(promise).resolves.toContain("testuser@test-router.example.test");
  expect(completed).toHaveBeenCalledWith("save");
});

test("resolves an empty command sequence when the shell closes", async () => {
  const client = new MockClient();
  const promise = interactive(client, []);
  await Promise.resolve();
  client.shellStream.emit("close");
  await expect(promise).resolves.toBe("");
});
