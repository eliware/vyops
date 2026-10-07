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

test("completes structured commands and empty sequences", async () => {
  const client = new MockClient();
  const completed = jest.fn();
  const promise = interactive(client, [{ phase: "save", command: "save" }], jest.fn(), completed);
  client.shellStream.emit("data", "\ntestuser@test-router.example.test# ");
  await expect(promise).resolves.toContain("testuser@test-router.example.test");
  expect(completed).toHaveBeenCalledWith("save");
  const emptyClient = new MockClient();
  const empty = interactive(emptyClient, []);
  emptyClient.shellStream.emit("close");
  await expect(empty).resolves.toBe("");
});
