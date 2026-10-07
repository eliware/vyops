import { EventEmitter } from "node:events";
import { jest } from "@jest/globals";

const connection = {
  close: jest.fn(),
  exec: jest.fn(),
  shell: jest.fn(),
};
const sharedConnect = jest.fn();
const log = { debug: jest.fn() };
jest.unstable_mockModule("@eliware/common", () => ({ log }));
jest.unstable_mockModule("@eliware/ssh-client", () => ({ connect: sharedConnect }));
const { adaptConnection } = await import("../../src/ssh/adapt-connection.mjs");
const { connect } = await import("../../src/ssh/connection.mjs");

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.VYOPS_OPERATION_TIMEOUT;
  sharedConnect.mockResolvedValue(connection);
  connection.exec.mockResolvedValue([{ code: 0, stdout: "output", stderr: "warning" }]);
  connection.shell.mockResolvedValue(new EventEmitter());
  connection.close.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.VYOPS_OPERATION_TIMEOUT;
});

test("adapts command, shell, and close events", async () => {
  process.env.VYOPS_OPERATION_TIMEOUT = "321";
  const client = await connect("vyos@router");
  expect(client.__vyopsConnection).toBe(connection);
  const received = new Promise((resolve, reject) => {
    client.exec("show version", (_error, stream) => {
      const output = [];
      const errors = [];
      stream.on("data", (data) => output.push(data.toString()));
      stream.stderr.on("data", (data) => errors.push(data.toString()));
      stream.on("close", (code) => resolve({ code, output, errors }));
      stream.on("error", reject);
      stream.close();
    });
  });
  await expect(received).resolves.toEqual({ code: 0, output: ["output"], errors: ["warning"] });
  expect(connection.exec).toHaveBeenCalledWith(["show version"], { timeout: 321 });

  connection.exec.mockResolvedValueOnce([{ code: 0, stdout: "", stderr: "" }]);
  const empty = new Promise((resolve, reject) => {
    client.exec("show empty", (_error, stream) => {
      stream.on("close", resolve);
      stream.on("error", reject);
    });
  });
  await expect(empty).resolves.toBe(0);

  const shell = new EventEmitter();
  connection.shell.mockResolvedValueOnce(shell);
  await expect(
    new Promise((resolve, reject) =>
      client.shell({ term: "xterm" }, (error, value) => (error ? reject(error) : resolve(value))),
    ),
  ).resolves.toBe(shell);
  const shellError = new Error("shell failed");
  connection.shell.mockRejectedValueOnce(shellError);
  await expect(new Promise((resolve) => client.shell({}, (error) => resolve(error)))).resolves.toBe(
    shellError,
  );

  await new Promise((resolve) => {
    client.once("close", resolve);
    client.end();
  });
  connection.close.mockRejectedValueOnce(new Error("close failed"));
  await new Promise((resolve) => {
    client.once("close", resolve);
    client.end();
  });
  connection.close.mockRejectedValueOnce(new Error("close failed"));
  const closeError = new Promise((resolve) => {
    client.once("error", resolve);
    client.end();
  });
  await expect(closeError).resolves.toMatchObject({ message: "close failed" });
});

test("maps command failures to stream errors", async () => {
  const client = adaptConnection(connection);
  const failure = new Error("command failed");
  connection.exec.mockRejectedValueOnce(failure);
  const result = new Promise((resolve) => {
    client.exec("show failure", (_error, stream) => stream.once("error", resolve));
  });
  await expect(result).resolves.toBe(failure);
});
