import { jest } from "@jest/globals";

const readFile = jest.fn();
const debug = jest.fn();
jest.unstable_mockModule("@eliware/common", () => ({
  fs: { promises: { readFile } },
  log: { debug },
}));
const { download } = await import("../../src/ssh/download.mjs");

beforeEach(() => {
  jest.clearAllMocks();
  readFile.mockResolvedValue(Buffer.from("data"));
});

afterEach(() => {
  delete process.env.VYOPS_OPERATION_TIMEOUT;
});

test("downloads and propagates SFTP failures", async () => {
  const sftp = {
    fastGet: jest.fn((_remote, _local, done) => done(new Error("download failed"))),
    end: jest.fn(),
  };
  const client = { sftp: (callback) => callback(null, sftp) };
  await expect(download(client, "remote", "local")).rejects.toThrow("download failed");
  expect(sftp.end).toHaveBeenCalled();
});

test("downloads successfully and rejects download setup failures", async () => {
  const sftp = { fastGet: jest.fn((_remote, _local, done) => done()), end: jest.fn() };
  await expect(
    download({ sftp: (callback) => callback(null, sftp) }, "remote", "local"),
  ).resolves.toBeUndefined();
  await expect(
    download({ sftp: (callback) => callback(new Error("setup failed")) }, "remote", "local"),
  ).rejects.toThrow("setup failed");
});

test("rejects download on timeout and includes client context", async () => {
  process.env.VYOPS_OPERATION_TIMEOUT = "1";
  const client = {
    sftp: jest.fn(),
    end: jest.fn(),
    __vyopsDeploymentId: "op",
    __vyopsTarget: "router",
    __vyopsPhase: "download",
  };
  await expect(download(client, "remote", "local")).rejects.toMatchObject({
    code: "VYOPS_TIMEOUT",
    message: expect.stringContaining("deployment=op target=router phase=download"),
  });
  expect(client.end).toHaveBeenCalled();
});

test("closes a late download SFTP callback after timeout", async () => {
  process.env.VYOPS_OPERATION_TIMEOUT = "1";
  let callback;
  const lateSftp = { end: jest.fn() };
  const client = {
    sftp: (value) => {
      callback = value;
    },
    end: jest.fn(),
  };
  await expect(download(client, "remote", "local")).rejects.toMatchObject({
    code: "VYOPS_TIMEOUT",
  });
  callback(null, lateSftp);
  expect(lateSftp.end).toHaveBeenCalled();
});

test("ignores duplicate download callbacks", async () => {
  let done;
  const sftp = {
    fastGet: jest.fn((_remote, _local, callback) => {
      done = callback;
    }),
    end: jest.fn(),
  };
  const promise = download({ sftp: (callback) => callback(null, sftp) }, "remote", "local");
  await new Promise((resolve) => setImmediate(resolve));
  done();
  done(new Error("late failure"));
  await expect(promise).resolves.toBeUndefined();
});

test("uses shared SSH transfers and maps timeout errors", async () => {
  const connection = { download: jest.fn().mockResolvedValue(undefined) };
  const client = {
    __vyopsConnection: connection,
    __vyopsDeploymentId: "op",
    __vyopsTarget: "router",
    __vyopsPhase: "download",
  };
  await expect(download(client, "remote", "local")).resolves.toBeUndefined();
  expect(connection.download).toHaveBeenCalledWith({
    remotePath: "remote",
    localPath: "local",
    timeout: 60000,
  });
  for (const code of ["SSH_TIMEOUT", "SSH_TRANSFER_TIMEOUT"]) {
    connection.download.mockRejectedValueOnce(Object.assign(new Error("timeout"), { code }));
    await expect(download(client, "remote", "local")).rejects.toMatchObject({
      code: "VYOPS_TIMEOUT",
      message: expect.stringContaining("deployment=op target=router phase=download"),
    });
  }
  const failure = new Error("transfer failed");
  connection.download.mockRejectedValueOnce(failure);
  await expect(download(client, "remote", "local")).rejects.toBe(failure);
});
