import { EventEmitter } from "node:events";
import { jest } from "@jest/globals";

class MockStream extends EventEmitter {
  constructor() {
    super();
    this.stderr = new EventEmitter();
    this.writes = [];
    this.closed = false;
    this.ended = false;
  }
  write(value) {
    this.writes.push(value);
  }
  end() {
    this.ended = true;
  }
  close() {
    this.closed = true;
    this.emit("close");
  }
}

class MockClient extends EventEmitter {
  static instances = [];
  constructor() {
    super();
    this.shellStream = new MockStream();
    this.sftpClient = {
      writeFile: (remote, data, options, callback) => callback(null),
      fastGet: (remote, local, callback) => callback(null),
    };
    MockClient.instances.push(this);
  }
  once(event, handler) {
    return super.once(event, handler);
  }
  connect(options) {
    this.options = options;
    const error = MockClient.nextConnectError;
    MockClient.nextConnectError = null;
    queueMicrotask(() => this.emit(error ? "error" : "ready", error));
  }
  end() {
    this.emit("close");
  }
  exec(command, callback) {
    this.execCallback?.(command, callback);
  }
  sftp(callback) {
    callback(null, this.sftpClient);
  }
  shell(options, callback) {
    this.shellOptions = options;
    callback(null, this.shellStream);
  }
}

import { exec } from "../../src/ssh/exec.mjs";

beforeEach(() => {
  MockClient.instances.length = 0;
});
afterEach(() => {
  delete process.env.VYOPS_INTERACTIVE_TIMEOUT;
  delete process.env.VYOPS_OPERATION_TIMEOUT;
});

test("exec resolves output and defaults missing close code", async () => {
  const client = new MockClient();
  client.execCallback = (command, callback) => {
    expect(command).toBe("show version");
    const stream = new MockStream();
    callback(null, stream);
    stream.emit("data", "out");
    stream.stderr.emit("data", "err");
    stream.emit("close");
  };
  await expect(exec(client, "show version")).resolves.toEqual({
    code: 1,
    stdout: "out",
    stderr: "err",
  });
});

test("exec rejects command setup errors", async () => {
  const client = new MockClient();
  client.execCallback = (_command, callback) => callback(new Error("exec failed"));
  await expect(exec(client, "bad")).rejects.toThrow("exec failed");
});

test("exec handles an empty command summary", async () => {
  const client = new MockClient();
  client.execCallback = (_command, callback) => {
    const stream = new MockStream();
    callback(null, stream);
    stream.emit("close", 0);
  };
  await expect(exec(client, "")).resolves.toEqual({ code: 0, stdout: "", stderr: "" });
});

test("exec handles stream errors and timeout", async () => {
  process.env.VYOPS_OPERATION_TIMEOUT = "not-a-number";
  const client = new MockClient();
  client.execCallback = (_command, callback) => {
    const stream = new MockStream();
    callback(null, stream);
    stream.emit("error", new Error("stream error"));
  };
  await expect(exec(client, "bad")).rejects.toThrow("stream error");
  client.execCallback = (_command, callback) => {
    const duplicateStream = new MockStream();
    callback(null, duplicateStream);
    duplicateStream.emit("close", 0);
    duplicateStream.emit("close", 1);
  };
  await expect(exec(client, "duplicate")).resolves.toEqual({ code: 0, stdout: "", stderr: "" });
  delete process.env.VYOPS_OPERATION_TIMEOUT;
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
  const timeoutClient = new MockClient();
  const promise = exec(timeoutClient, "slow");
  jest.advanceTimersByTime(60000);
  await expect(promise).rejects.toThrow(
    /SSH command timed out \[[0-9a-f-]+\] \(deployment=unknown target=unknown phase=unknown\): slow/,
  );
  jest.useRealTimers();
});

test("exec uses a positive configured operation timeout", async () => {
  process.env.VYOPS_OPERATION_TIMEOUT = "1";
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
  const client = new MockClient();
  const promise = exec(client, "slow-configured");
  jest.advanceTimersByTime(1);
  await expect(promise).rejects.toThrow(/SSH command timed out/);
  jest.useRealTimers();
  delete process.env.VYOPS_OPERATION_TIMEOUT;
});
