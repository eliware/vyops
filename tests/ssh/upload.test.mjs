import { jest } from "@jest/globals";

const debug = jest.fn();
jest.unstable_mockModule("@eliware/common", () => ({ log: { debug } }));
const { upload } = await import("../../src/ssh/upload.mjs");

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.VYOPS_OPERATION_TIMEOUT;
});

test("uploads with the configured mode and timeout", async () => {
  process.env.VYOPS_OPERATION_TIMEOUT = "321";
  const client = { upload: jest.fn().mockResolvedValue(undefined) };
  await expect(upload(client, "local", "remote", 0o640)).resolves.toBeUndefined();
  expect(client.upload).toHaveBeenCalledWith({
    localPath: "local",
    remotePath: "remote",
    mode: 0o640,
    timeout: 321,
  });
  expect(debug).toHaveBeenCalledWith(expect.stringContaining("local -> remote"));
});

test("uses the default timeout for invalid and non-positive values", async () => {
  const client = { upload: jest.fn().mockResolvedValue(undefined) };
  for (const value of ["bad", "0"]) {
    process.env.VYOPS_OPERATION_TIMEOUT = value;
    await upload(client, "local", "remote");
  }
  expect(client.upload).toHaveBeenNthCalledWith(1, expect.objectContaining({ timeout: 60000 }));
  expect(client.upload).toHaveBeenNthCalledWith(2, expect.objectContaining({ timeout: 60000 }));
});

test("maps transfer timeouts and adds VyOps context", async () => {
  const client = {
    __vyopsDeploymentId: "op",
    __vyopsTarget: "router",
    __vyopsPhase: "upload",
    upload: jest.fn(),
  };
  for (const code of ["SSH_TIMEOUT", "SSH_TRANSFER_TIMEOUT"]) {
    client.upload.mockRejectedValueOnce(Object.assign(new Error("timed out"), { code }));
    await expect(upload(client, "local", "remote")).rejects.toMatchObject({
      code: "VYOPS_TIMEOUT",
      message: expect.stringContaining("deployment=op target=router phase=upload"),
    });
  }
  client.upload.mockRejectedValueOnce(
    Object.assign(new Error("timed out"), { code: "SSH_TIMEOUT" }),
  );
  await expect(upload({ upload: client.upload }, "local", "remote")).rejects.toThrow(
    /deployment=unknown target=unknown phase=unknown/,
  );
});

test("preserves other transfer errors", async () => {
  const error = new Error("transfer failed");
  await expect(
    upload({ upload: jest.fn().mockRejectedValue(error) }, "local", "remote"),
  ).rejects.toBe(error);
});
