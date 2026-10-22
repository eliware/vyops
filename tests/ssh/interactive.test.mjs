import { jest } from "@jest/globals";
import { EventEmitter } from "node:events";

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

class MockClient {
  static instances = [];
  constructor() {
    this.shellStream = new MockStream();
    MockClient.instances.push(this);
  }
  shell(options) {
    this.shellOptions = options;
    return Promise.resolve(this.shellStream);
  }
}

const { interactive } = await import("../../src/ssh/interactive.mjs");

beforeEach(() => {
  MockClient.instances.length = 0;
});
afterEach(() => {
  jest.useRealTimers();
  delete process.env.VYOPS_INTERACTIVE_TIMEOUT;
  delete process.env.VYOPS_OPERATION_TIMEOUT;
});

test("interactive runs commands, handles pager and commit confirmation", async () => {
  const client = new MockClient();
  const log = jest.fn();
  const promise = interactive(client, ["first", "second"], log);
  await Promise.resolve();
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

test("handles a commit confirmation split across output events", async () => {
  const client = new MockClient();
  const promise = interactive(client, ["commit-confirm 5"]);
  await Promise.resolve();
  const stream = client.shellStream;
  stream.emit("data", "Proceed? [Y");
  expect(stream.writes).toEqual(["commit-confirm 5\n"]);
  stream.emit("data", "/n] ");
  expect(stream.writes).toEqual(["commit-confirm 5\n", "yes\n"]);
  stream.emit("data", "\ntestuser@test-router.example.test# ");
  await expect(promise).resolves.toContain("Proceed? [Y/n]");
});

test("uses default log and completion callbacks", async () => {
  process.env.VYOPS_INTERACTIVE_TIMEOUT = "321";
  const client = new MockClient();
  const promise = interactive(client, ["show version"]);
  await Promise.resolve();
  client.shellStream.emit("data", "testuser@router# ");
  await expect(promise).resolves.toContain("testuser@router#");
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

test("resolves an empty sequence when the shell closes", async () => {
  const client = new MockClient();
  const promise = interactive(client, []);
  await Promise.resolve();
  client.shellStream.emit("close");
  await expect(promise).resolves.toBe("");
});

test.each([
  ["save", /save failed/i, "save failed\ntestuser@test-router.example.test# "],
  ["commit-confirm 5", /commit failed|error/i, "Configuration commit failed; rollback in progress"],
])("interactive rejects failed structured command: %s", async (command, reject, response) => {
  const client = new MockClient();
  const promise = interactive(client, [{ command, reject }]);
  await Promise.resolve();
  client.shellStream.emit("data", response);
  await expect(promise).rejects.toThrow(`interactive command failed: ${command}`);
});

test("interactive reports structured failures without a matching detail line", async () => {
  const client = new MockClient();
  const promise = interactive(client, [{ command: "load /tmp/config", reject: /^x/ }]);
  await Promise.resolve();
  client.shellStream.emit("data", "x");
  await expect(promise).rejects.toThrow("interactive command failed: load /tmp/config");
});

test("interactive rejects commit-confirm after VyOS reports a validation error", async () => {
  const client = new MockClient();
  const promise = interactive(client, [
    { command: "commit-confirm 5", reject: /(?:commit failed|commit aborted|invalid|error)/i },
  ]);
  await Promise.resolve();
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

test("interactive rejects a shell creation failure", async () => {
  const shellErrorClient = {
    shell: async () => {
      throw new Error("shell failed");
    },
  };
  await expect(interactive(shellErrorClient, ["x"])).rejects.toThrow("shell failed");
});

test("interactive rejects a synchronous shell creation failure", async () => {
  const shellErrorClient = {
    shell() {
      throw new Error("shell failed");
    },
  };
  await expect(interactive(shellErrorClient, ["x"])).rejects.toThrow("shell failed");
});

test("times out while the shell request remains pending", async () => {
  process.env.VYOPS_INTERACTIVE_TIMEOUT = "10";
  let openShell;
  const client = { shell: () => new Promise((resolve) => (openShell = resolve)) };
  const promise = interactive(client, ["show version"]);
  await Promise.resolve();
  await expect(promise).rejects.toMatchObject({ code: "VYOPS_TIMEOUT" });
  const stream = new MockStream();
  openShell(stream);
  await Promise.resolve();
  await Promise.resolve();
  expect(stream.closed).toBe(true);
});

test("ignores a shell failure after the timeout", async () => {
  process.env.VYOPS_INTERACTIVE_TIMEOUT = "10";
  let failShell;
  const client = { shell: () => new Promise((_resolve, reject) => (failShell = reject)) };
  const promise = interactive(client, ["show version"]);
  await Promise.resolve();
  await expect(promise).rejects.toMatchObject({ code: "VYOPS_TIMEOUT" });
  failShell(new Error("late shell failure"));
  await Promise.resolve();
});

test.each([
  ["boom\n", /boom/],
  ["save failed", /save failed/i],
])("interactive rejects structured errors on stderr", async (response, reject) => {
  const client = new MockClient();
  const promise = interactive(client, [{ command: "save", reject }]);
  await Promise.resolve();
  client.shellStream.stderr.emit("data", response);
  await expect(promise).rejects.toThrow("interactive command failed: save");
});
