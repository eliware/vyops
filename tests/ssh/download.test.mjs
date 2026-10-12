import { jest } from "@jest/globals";

const debug = jest.fn();
jest.unstable_mockModule("@eliware/common", () => ({ log: { debug } }));
const { download } = await import("../../src/ssh/download.mjs");

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.VYOPS_OPERATION_TIMEOUT;
});

test("downloads with the configured timeout", async () => {
  process.env.VYOPS_OPERATION_TIMEOUT = "321";
  const client = { download: jest.fn().mockResolvedValue(undefined) };
  await expect(download(client, "remote", "local")).resolves.toBeUndefined();
  expect(client.download).toHaveBeenCalledWith({
    remotePath: "remote",
    localPath: "local",
    timeout: 321,
  });
  expect(debug).toHaveBeenCalledWith(expect.stringContaining("remote -> local"));
});

test("uses the default timeout for invalid and non-positive values", async () => {
  const client = { download: jest.fn().mockResolvedValue(undefined) };
  for (const value of ["bad", "0"]) {
    process.env.VYOPS_OPERATION_TIMEOUT = value;
    await download(client, "remote", "local");
  }
  expect(client.download).toHaveBeenNthCalledWith(1, expect.objectContaining({ timeout: 60000 }));
  expect(client.download).toHaveBeenNthCalledWith(2, expect.objectContaining({ timeout: 60000 }));
});

test("maps transfer timeouts and adds VyOps context", async () => {
  const client = {
    __vyopsDeploymentId: "op",
    __vyopsTarget: "router",
    __vyopsPhase: "download",
    download: jest.fn(),
  };
  for (const code of ["SSH_TIMEOUT", "SSH_TRANSFER_TIMEOUT"]) {
    client.download.mockRejectedValueOnce(Object.assign(new Error("timed out"), { code }));
    await expect(download(client, "remote", "local")).rejects.toMatchObject({
      code: "VYOPS_TIMEOUT",
      message: expect.stringContaining("deployment=op target=router phase=download"),
    });
  }
  client.download.mockRejectedValueOnce(
    Object.assign(new Error("timed out"), { code: "SSH_TIMEOUT" }),
  );
  await expect(download({ download: client.download }, "remote", "local")).rejects.toThrow(
    /deployment=unknown target=unknown phase=unknown/,
  );
});

test("preserves other transfer errors", async () => {
  const error = new Error("transfer failed");
  await expect(
    download({ download: jest.fn().mockRejectedValue(error) }, "remote", "local"),
  ).rejects.toBe(error);
});
