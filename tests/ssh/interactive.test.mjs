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

import { interactive } from "../../src/ssh/interactive.mjs";

beforeEach(() => {
  MockClient.instances.length = 0;
});
afterEach(() => {
  jest.useRealTimers();
  delete process.env.VYOPS_INTERACTIVE_TIMEOUT;
  delete process.env.VYOPS_INTERACTIVE_TIMEOUT;
  delete process.env.VYOPS_OPERATION_TIMEOUT;
});

test("interactive runs commands, handles pager and commit confirmation", async () => {
  const client = new MockClient();
  const log = jest.fn();
  const promise = interactive(client, ["first", "second"], log);
  const stream = client.shellStream;
  expect(stream.writes).toEqual(["first\n"]);
  stream.emit("data", "router output");
  stream.emit("data", "\n:");
  expect(stream.writes).toEqual(["first\n", " "]);
  stream.emit("data", "\ntestuser@test-router.example.test#");
  expect(stream.writes).toEqual(["first\n", " ", "second\n"]);
  stream.stderr.emit("data", "warning");
  stream.emit("data", "Proceed? [Y/n]");
  expect(stream.writes).toEqual(["first\n", " ", "second\n", "yes\n"]);
  stream.emit("data", "\ntestuser@test-router.example.test#");
  await expect(promise).resolves.toContain("Proceed? [Y/n]");
  stream.emit("data", "\ntestuser@test-router.example.test#");
  expect(stream.ended).toBe(true);
});

test("uses default log and completion callbacks", async () => {
  process.env.VYOPS_INTERACTIVE_TIMEOUT = "321";
  const client = new MockClient();
  const promise = interactive(client, ["show version"]);
  client.shellStream.emit("data", "testuser@router# ");
  await expect(promise).resolves.toContain("testuser@router#");
});

test("interactive handles VyOS return-only pager prompts", async () => {
  const client = new MockClient();
  const promise = interactive(client, ["first"]);
  const stream = client.shellStream;
  stream.emit("data", "No next tag (press RETURN)");
  expect(stream.writes).toEqual(["first\n", "\n"]);
  stream.emit("close");
  await expect(promise).rejects.toThrow("interactive SSH closed before command sequence completed");
});

test.each([
  ["save", /save failed/i, "save failed\ntestuser@test-router.example.test# "],
  ["commit-confirm 5", /commit failed|error/i, "Configuration commit failed; rollback in progress"],
])("interactive rejects failed structured command: %s", async (command, reject, response) => {
  const client = new MockClient();
  const promise = interactive(client, [{ command, reject }]);
  client.shellStream.emit("data", response);
  await expect(promise).rejects.toThrow(`interactive command failed: ${command}`);
});

test("interactive reports structured failures without a matching detail line", async () => {
  const client = new MockClient();
  const promise = interactive(client, [{ command: "load /tmp/config", reject: /^x/ }]);
  client.shellStream.emit("data", "x");
  await expect(promise).rejects.toThrow("interactive command failed: load /tmp/config");
});

test("interactive rejects commit-confirm after VyOS reports a validation error", async () => {
  const client = new MockClient();
  const promise = interactive(client, [
    { command: "commit-confirm 5", reject: /(?:commit failed|commit aborted|invalid|error)/i },
  ]);
  client.shellStream.emit(
    "data",
    "commit-confirm will automatically reload previous config in 5 minutes\nProceed ? [Y/n] ",
  );
  expect(client.shellStream.writes).toEqual(["commit-confirm 5\n", "yes\n"]);
  client.shellStream.emit(
    "data",
    'Initialized commit-confirm; 5 minutes to confirm before reload\n[pki] Invalid private key on certificate "sangahnoona.com"',
  );
  await expect(promise).rejects.toThrow(
    'interactive command failed: commit-confirm 5 ([pki] Invalid private key on certificate "[redacted]")',
  );
});

test("interactive handles shell, stream, close, and timeout failures", async () => {
  const shellErrorClient = { shell: (_options, callback) => callback(new Error("shell failed")) };
  await expect(interactive(shellErrorClient, ["x"])).rejects.toThrow("shell failed");

  const errorClient = new MockClient();
  const errorPromise = interactive(errorClient, ["x"]);
  errorClient.shellStream.emit("error", new Error("stream failed"));
  await expect(errorPromise).rejects.toThrow("stream failed");

  const closeClient = new MockClient();
  const closePromise = interactive(closeClient, ["x"]);
  closeClient.shellStream.emit("close");
  await expect(closePromise).rejects.toThrow(
    "interactive SSH closed before command sequence completed",
  );

  const exitClient = new MockClient();
  const exitPromise = interactive(exitClient, ["exit"]);
  exitClient.shellStream.emit("close");
  await expect(exitPromise).resolves.toBe("");

  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
  const timeoutClient = new MockClient();
  const timeoutPromise = interactive(timeoutClient, ["x"]);
  jest.advanceTimersByTime(60000);
  await expect(timeoutPromise).rejects.toThrow(
    /Interactive SSH timed out \[[0-9a-f-]+\] \(deployment=unknown target=unknown phase=unknown\): x/,
  );
  expect(timeoutClient.shellStream.closed).toBe(true);

  const objectTimeoutClient = new MockClient();
  const objectTimeoutPromise = interactive(objectTimeoutClient, [
    { phase: "test-phase", command: "x" },
  ]);
  jest.advanceTimersByTime(60000);
  await expect(objectTimeoutPromise).rejects.toThrow(/Interactive SSH timed out/);

  const emptyTimeoutClient = new MockClient();
  const emptyTimeoutPromise = interactive(emptyTimeoutClient, []);
  jest.advanceTimersByTime(60000);
  await expect(emptyTimeoutPromise).rejects.toThrow(/Interactive SSH timed out.*none/);
  jest.useRealTimers();
});

test.each([
  ["boom\n", /boom/],
  ["save failed", /save failed/i],
])("interactive rejects structured errors on stderr", async (response, reject) => {
  const client = new MockClient();
  const promise = interactive(client, [{ command: "save", reject }]);
  client.shellStream.stderr.emit("data", response);
  await expect(promise).rejects.toThrow("interactive command failed: save");
});
