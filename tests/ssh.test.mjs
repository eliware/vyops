import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import fs from "node:fs";
import { jest } from "@jest/globals";
import {
  MockClient,
  MockStream,
  fs as fixtureFs,
  mockHostVerifier,
  createSshClientModule,
} from "../test-fixtures/ssh-client.mjs";
jest.unstable_mockModule("@eliware/ssh-client", () =>
  createSshClientModule({ MockClient, fs: fixtureFs, join, mockHostVerifier }),
);
const { exec } = await import("../src/ssh/exec.mjs");
const { upload } = await import("../src/ssh/upload.mjs");
const { download } = await import("../src/ssh/download.mjs");
const { connect, close, closeAll } = await import("../src/ssh.mjs");

beforeEach(() => {
  MockClient.instances.length = 0;
  delete process.env.VYOPS_SSH_KEY;
  delete process.env.SSH_AUTH_SOCK;
  process.env.HOME = ["", "home", "test"].join("/");
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete process.env.VYOPS_CONNECT_TIMEOUT;
  delete process.env.VYOPS_OPERATION_TIMEOUT;
});

test("closeAll ends active SSH clients", async () => {
  const keyDir = await mkdtemp(join(tmpdir(), "ssh-test-"));
  const key = join(keyDir, "key");
  await writeFile(key, "key");
  await mkdir(join(keyDir, ".ssh"), { recursive: true });
  await writeFile(join(keyDir, ".ssh/known_hosts"), "router ssh-ed25519 AAAA\n");
  process.env.HOME = keyDir;
  process.env.VYOPS_SSH_KEY = key;
  await connect("vyos@router");
  await closeAll();
  expect(MockClient.instances.at(-1).shellStream.closed).toBe(false);
  await rm(keyDir, { recursive: true, force: true });
});

test("ignores SSH and SFTP callbacks that arrive after timeout", async () => {
  jest.useFakeTimers();
  const execClient = new MockClient();
  let execCallback;
  execClient.execCallback = (_command, callback) => {
    execCallback = callback;
  };
  const execPromise = exec(execClient, "slow").catch((error) => error);
  jest.advanceTimersByTime(60000);
  const lateStream = new MockStream();
  execCallback(null, lateStream);
  await expect(execPromise).resolves.toMatchObject({
    message: expect.stringContaining("SSH command timed out"),
  });
  expect(lateStream.closed).toBe(true);

  const uploadClient = new MockClient();
  let sftpCallback;
  uploadClient.sftp = (callback) => {
    sftpCallback = callback;
  };
  const readFile = jest.spyOn(fs.promises, "readFile").mockResolvedValue(Buffer.from("config"));
  const uploadPromise = upload(uploadClient, "/local", "/remote").catch((error) => error);
  await Promise.resolve();
  jest.advanceTimersByTime(60000);
  const lateSftp = { end: jest.fn() };
  sftpCallback(null, lateSftp);
  await expect(uploadPromise).resolves.toMatchObject({
    message: expect.stringContaining("SFTP upload timed out"),
  });
  expect(lateSftp.end).toHaveBeenCalled();

  const duplicateUploadClient = new MockClient();
  let duplicateUploadCallback;
  duplicateUploadClient.sftpClient.writeFile = (_remote, _data, _options, callback) => {
    duplicateUploadCallback = callback;
  };
  const duplicateUploadPromise = upload(duplicateUploadClient, "/local", "/remote").catch(
    (error) => error,
  );
  await Promise.resolve();
  jest.advanceTimersByTime(60000);
  duplicateUploadCallback(undefined);
  await expect(duplicateUploadPromise).resolves.toMatchObject({
    message: expect.stringContaining("SFTP upload timed out"),
  });

  const downloadClient = new MockClient();
  let downloadCallback;
  downloadClient.sftp = (callback) => {
    downloadCallback = callback;
  };
  const downloadPromise = download(downloadClient, "/remote", "/local").catch((error) => error);
  await Promise.resolve();
  jest.advanceTimersByTime(60000);
  const lateDownload = { end: jest.fn() };
  downloadCallback(null, lateDownload);
  await expect(downloadPromise).resolves.toMatchObject({
    message: expect.stringContaining("SFTP download timed out"),
  });
  expect(lateDownload.end).toHaveBeenCalled();

  const duplicateDownloadClient = new MockClient();
  duplicateDownloadClient.sftpClient.fastGet = (_remote, _local, callback) => {
    callback(undefined);
    callback(undefined);
  };
  await expect(download(duplicateDownloadClient, "/remote", "/local")).resolves.toBeUndefined();
  readFile.mockRestore();
  jest.useRealTimers();
});

test("close handles null and error", async () => {
  await expect(close(null)).resolves.toBeUndefined();
  jest.useFakeTimers();
  const client = new MockClient();
  const promise = close(client);
  client.emit("error", new Error("close error"));
  await expect(promise).resolves.toBeUndefined();
  expect(jest.getTimerCount()).toBe(0);
});
