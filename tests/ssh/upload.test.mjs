import { jest } from "@jest/globals";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MockClient, fs } from "../../test-fixtures/ssh-client.mjs";

const readFile = jest.fn();
const debug = jest.fn();
jest.unstable_mockModule("@eliware/common", () => ({
  fs: { promises: { readFile } },
  log: { debug },
}));
const { upload } = await import("../../src/ssh/upload.mjs");
const { download } = await import("../../src/ssh/download.mjs");

beforeEach(() => {
  jest.clearAllMocks();
  readFile.mockResolvedValue(Buffer.from("data"));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete process.env.VYOPS_OPERATION_TIMEOUT;
});

test("uploads data with the requested mode and closes SFTP", async () => {
  const sftp = { writeFile: jest.fn((_remote, _data, _options, done) => done()), end: jest.fn() };
  const client = { sftp: (callback) => callback(null, sftp) };
  await expect(upload(client, "local", "remote", 0o755)).resolves.toBeUndefined();
  expect(sftp.writeFile).toHaveBeenCalledWith(
    "remote",
    Buffer.from("data"),
    { mode: 0o755 },
    expect.any(Function),
  );
  expect(sftp.end).toHaveBeenCalled();
});

test("rejects upload when SFTP setup fails", async () => {
  const client = { sftp: (callback) => callback(new Error("sftp unavailable")) };
  await expect(upload(client, "local", "remote")).rejects.toThrow("sftp unavailable");
});

test("rejects upload on timeout and closes the SSH client", async () => {
  process.env.VYOPS_OPERATION_TIMEOUT = "1";
  const client = { sftp: jest.fn(), end: jest.fn() };
  await expect(upload(client, "local", "remote")).rejects.toMatchObject({ code: "VYOPS_TIMEOUT" });
  expect(client.end).toHaveBeenCalled();
});

test("closes a late upload SFTP callback after timeout", async () => {
  process.env.VYOPS_OPERATION_TIMEOUT = "1";
  let callback;
  const lateSftp = { end: jest.fn() };
  const client = {
    sftp: (value) => {
      callback = value;
    },
    end: jest.fn(),
  };
  await expect(upload(client, "local", "remote")).rejects.toMatchObject({ code: "VYOPS_TIMEOUT" });
  callback(null, lateSftp);
  expect(lateSftp.end).toHaveBeenCalled();
});

test("ignores duplicate upload callbacks", async () => {
  let done;
  const sftp = {
    writeFile: jest.fn((_remote, _data, _options, callback) => {
      done = callback;
    }),
    end: jest.fn(),
  };
  const promise = upload({ sftp: (callback) => callback(null, sftp) }, "local", "remote");
  await new Promise((resolve) => setImmediate(resolve));
  done();
  done(new Error("late failure"));
  await expect(promise).resolves.toBeUndefined();
});

test("propagates upload write failures", async () => {
  const sftp = {
    writeFile: jest.fn((_remote, _data, _options, callback) => callback(new Error("write failed"))),
    end: jest.fn(),
  };
  await expect(
    upload({ sftp: (callback) => callback(null, sftp) }, "local", "remote"),
  ).rejects.toThrow("write failed");
});

test("upload and download resolve on successful SFTP operations", async () => {
  const keyDir = await mkdtemp(join(tmpdir(), "ssh-test-"));
  const local = join(keyDir, "local");
  await writeFile(local, "config");
  const client = new MockClient();
  await expect(upload(client, local, "/remote")).resolves.toBeUndefined();
  expect(client.sftpClient.writeFile).toBeDefined();
  await expect(download(client, "/remote", join(keyDir, "copy"))).resolves.toBeUndefined();
  await rm(keyDir, { recursive: true, force: true });
});

test("upload and download reject SFTP and operation errors", async () => {
  const keyDir = await mkdtemp(join(tmpdir(), "ssh-test-"));
  const local = join(keyDir, "local");
  await writeFile(local, "config");
  const client = new MockClient();
  client.sftp = (callback) => callback(new Error("sftp failed"));
  await expect(upload(client, local, "/remote")).rejects.toThrow("sftp failed");
  await expect(download(client, "/remote", join(keyDir, "copy"))).rejects.toThrow("sftp failed");

  const operationClient = new MockClient();
  operationClient.sftpClient.writeFile = (_remote, _data, _options, callback) =>
    callback(new Error("write failed"));
  operationClient.sftpClient.fastGet = (_remote, _local, callback) =>
    callback(new Error("get failed"));
  await expect(upload(operationClient, local, "/remote")).rejects.toThrow("write failed");
  await expect(download(operationClient, "/remote", join(keyDir, "copy"))).rejects.toThrow(
    "get failed",
  );
  await rm(keyDir, { recursive: true, force: true });
});

test("SFTP upload and download time out", async () => {
  const readFile = jest.spyOn(fs.promises, "readFile").mockResolvedValue(Buffer.from("config"));
  jest.useFakeTimers();
  const client = new MockClient();
  client.sftpClient.writeFile = () => {};
  client.sftpClient.fastGet = () => {};
  const uploadPromise = upload(client, "/local", "/remote").catch((error) => error);
  await Promise.resolve();
  await Promise.resolve();
  jest.advanceTimersByTime(60000);
  await expect(uploadPromise).resolves.toMatchObject({
    message: expect.stringMatching(
      /SFTP upload timed out \[[0-9a-f-]+\] \(deployment=unknown target=unknown phase=unknown\): \/remote/,
    ),
  });
  const downloadPromise = download(client, "/remote", "/local").catch((error) => error);
  jest.advanceTimersByTime(60000);
  await expect(downloadPromise).resolves.toMatchObject({
    message: expect.stringMatching(
      /SFTP download timed out \[[0-9a-f-]+\] \(deployment=unknown target=unknown phase=unknown\): \/remote/,
    ),
  });
  jest.useRealTimers();
  readFile.mockRestore();
});

test("uses shared SSH transfers and maps timeout errors", async () => {
  const connection = { upload: jest.fn().mockResolvedValue(undefined) };
  const client = {
    __vyopsConnection: connection,
    __vyopsDeploymentId: "op",
    __vyopsTarget: "router",
    __vyopsPhase: "upload",
  };
  await expect(upload(client, "local", "remote", 0o640)).resolves.toBeUndefined();
  expect(connection.upload).toHaveBeenCalledWith({
    localPath: "local",
    remotePath: "remote",
    mode: 0o640,
    timeout: 60000,
  });
  for (const code of ["SSH_TIMEOUT", "SSH_TRANSFER_TIMEOUT"]) {
    connection.upload.mockRejectedValueOnce(Object.assign(new Error("timeout"), { code }));
    await expect(upload(client, "local", "remote")).rejects.toMatchObject({
      code: "VYOPS_TIMEOUT",
      message: expect.stringContaining("deployment=op target=router phase=upload"),
    });
  }
  const failure = new Error("transfer failed");
  connection.upload.mockRejectedValueOnce(failure);
  await expect(upload(client, "local", "remote")).rejects.toBe(failure);
});
