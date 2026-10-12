import { EventEmitter } from "node:events";
import { jest } from "@jest/globals";
import { attachInteractiveListeners } from "../../src/ssh/interactive-listeners.mjs";
import { interactive } from "../../src/ssh/interactive.mjs";
import { MockClient } from "../../test-fixtures/ssh-client.mjs";

test("attaches stream error and close handlers", () => {
  const stream = new EventEmitter();
  stream.stderr = new EventEmitter();
  const reject = jest.fn();
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
    timer: setTimeout(() => {}, 60000),
    sendNext: jest.fn(),
    resolve: jest.fn(),
    reject,
    onCommandComplete: jest.fn(),
  });
  stream.emit("error", new Error("stream failed"));
  expect(reject).toHaveBeenCalledWith(expect.objectContaining({ message: "stream failed" }));
});

test("rejects early close and resolves expected exit", () => {
  const createState = (index) => ({
    output: "output",
    response: "",
    index,
    waiting: false,
    answering: false,
    settled: false,
    timedOut: false,
  });
  const earlyStream = new EventEmitter();
  earlyStream.stderr = new EventEmitter();
  const reject = jest.fn();
  attachInteractiveListeners({
    stream: earlyStream,
    client: {},
    commands: ["run"],
    log: jest.fn(),
    state: createState(0),
    timer: setTimeout(() => {}, 60000),
    sendNext: jest.fn(),
    resolve: jest.fn(),
    reject,
    onCommandComplete: jest.fn(),
  });
  earlyStream.emit("close");
  expect(reject).toHaveBeenCalledWith(
    expect.objectContaining({
      message: "interactive SSH closed before command sequence completed",
    }),
  );

  const exitStream = new EventEmitter();
  exitStream.stderr = new EventEmitter();
  const resolve = jest.fn();
  attachInteractiveListeners({
    stream: exitStream,
    client: {},
    commands: ["exit"],
    log: jest.fn(),
    state: createState(1),
    timer: setTimeout(() => {}, 60000),
    sendNext: jest.fn(),
    resolve,
    reject: jest.fn(),
    onCommandComplete: jest.fn(),
  });
  exitStream.emit("close");
  expect(resolve).toHaveBeenCalledWith("output");
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
