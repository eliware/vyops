import { EventEmitter } from "node:events";
import { jest } from "@jest/globals";
import { attachInteractiveData } from "../../src/ssh/interactive-data.mjs";

test("resolves a command after the router prompt", () => {
  const stream = new EventEmitter();
  stream.close = jest.fn();
  stream.end = jest.fn();
  stream.write = jest.fn();
  const resolve = jest.fn();
  const timer = setTimeout(() => {}, 60000);
  const state = {
    output: "",
    response: "",
    index: 1,
    waiting: true,
    answering: false,
    settled: false,
    timedOut: false,
    currentItem: "show version",
  };
  attachInteractiveData({
    stream,
    state,
    commands: ["show version"],
    log: jest.fn(),
    timer,
    resolve,
    reject: jest.fn(),
    onCommandComplete: jest.fn(),
    sendNext: jest.fn(),
  });
  stream.emit("data", Buffer.from("user@vyos#"));
  expect(resolve).toHaveBeenCalledWith("user@vyos#");
});
