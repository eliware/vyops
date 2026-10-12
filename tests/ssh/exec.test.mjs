import { jest } from "@jest/globals";

const debug = jest.fn();
jest.unstable_mockModule("@eliware/common", () => ({ log: { debug } }));
const { exec } = await import("../../src/ssh/exec.mjs");

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.VYOPS_OPERATION_TIMEOUT;
});

test("runs one command with the configured limit", async () => {
  process.env.VYOPS_OPERATION_TIMEOUT = "321";
  const result = { code: 0, stdout: "out", stderr: "err" };
  const client = { exec: jest.fn().mockResolvedValue([result]) };
  await expect(exec(client, "show version")).resolves.toBe(result);
  expect(client.exec).toHaveBeenCalledWith(["show version"], { commandTimeout: 321 });
  expect(debug).toHaveBeenCalledWith(expect.stringContaining("show version"));
});

test("uses the default limit for invalid or non-positive values", async () => {
  const client = { exec: jest.fn().mockResolvedValue([{ code: 0 }]) };
  for (const value of ["bad", "0", "-1"]) {
    process.env.VYOPS_OPERATION_TIMEOUT = value;
    await exec(client, "show version");
  }
  expect(client.exec).toHaveBeenNthCalledWith(1, ["show version"], { commandTimeout: 60000 });
  expect(client.exec).toHaveBeenNthCalledWith(3, ["show version"], { commandTimeout: 60000 });
});

test("adds VyOps context to command timeout errors", async () => {
  const error = Object.assign(new Error("timed out"), { code: "SSH_TIMEOUT" });
  const client = {
    __vyopsDeploymentId: "op",
    __vyopsTarget: "router",
    __vyopsPhase: "release",
    exec: jest.fn().mockRejectedValue(error),
  };
  await expect(exec(client, "show version")).rejects.toMatchObject({
    code: "VYOPS_TIMEOUT",
    message: expect.stringContaining("deployment=op target=router phase=release"),
  });
});

test("uses unknown context when a command times out without metadata", async () => {
  const client = {
    exec: jest
      .fn()
      .mockRejectedValue(Object.assign(new Error("timed out"), { code: "SSH_TIMEOUT" })),
  };
  await expect(exec(client, "show version")).rejects.toThrow(
    /deployment=unknown target=unknown phase=unknown/,
  );
});

test("preserves other command errors", async () => {
  const error = new Error("command failed");
  await expect(exec({ exec: jest.fn().mockRejectedValue(error) }, "show version")).rejects.toBe(
    error,
  );
});
