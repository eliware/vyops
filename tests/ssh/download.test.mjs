import { jest } from "@jest/globals";

const debug = jest.fn();
jest.unstable_mockModule("@eliware/common", () => ({ log: { debug } }));
const { download } = await import("../../src/ssh/download.mjs");

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.VYOPS_OPERATION_TIMEOUT;
});

test("downloads the remote path and logs the transfer", async () => {
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
