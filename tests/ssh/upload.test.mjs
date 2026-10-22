import { jest } from "@jest/globals";

const debug = jest.fn();
jest.unstable_mockModule("@eliware/common", () => ({ log: { debug } }));
const { upload } = await import("../../src/ssh/upload.mjs");

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.VYOPS_OPERATION_TIMEOUT;
});

test("uploads the local path with its mode and logs the transfer", async () => {
  const client = { upload: jest.fn().mockResolvedValue(undefined) };
  await expect(upload(client, "local", "remote", 0o640)).resolves.toBeUndefined();
  expect(client.upload).toHaveBeenCalledWith(
    expect.objectContaining({ localPath: "local", remotePath: "remote", mode: 0o640 }),
  );
  expect(debug).toHaveBeenCalledWith(expect.stringContaining("local -> remote"));

  const defaultClient = { upload: jest.fn().mockResolvedValue(undefined) };
  await expect(upload(defaultClient, "local", "remote")).resolves.toBeUndefined();
  expect(defaultClient.upload).toHaveBeenCalledWith(expect.objectContaining({ mode: 0o600 }));
});
