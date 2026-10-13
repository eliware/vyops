import { jest } from "@jest/globals";
import { startDeployment } from "../../src/deploy/start.mjs";

test("connects once and registers cleanup", async () => {
  const client = {};
  const connect = jest.fn().mockResolvedValue(client);
  const setClient = jest.fn();
  const result = await startDeployment({
    target: "router",
    operationId: "op",
    connect,
    close: jest.fn(),
    exec: jest.fn(),
    log: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    getClient: () => client,
    setClient,
  });
  expect(connect).toHaveBeenCalledWith("router");
  expect(setClient).toHaveBeenCalledWith(client);
  expect(typeof result.unregisterCleanup).toBe("function");
});

test("closes the SSH client when setup fails after connection", async () => {
  const client = {};
  const close = jest.fn();
  await expect(
    startDeployment({
      target: "router",
      operationId: "op",
      connect: jest.fn().mockResolvedValue(client),
      close,
      exec: jest.fn(),
      log: {
        debug: jest
          .fn()
          .mockImplementationOnce(() => {})
          .mockImplementationOnce(() => {})
          .mockImplementationOnce(() => {
            throw new Error("log failed");
          }),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      getClient: () => client,
      setClient: jest.fn(),
    }),
  ).rejects.toThrow("log failed");
  expect(close).toHaveBeenCalledWith(client);
});

test("keeps the setup error when SSH close also fails", async () => {
  const client = {};
  const log = {
    debug: jest
      .fn()
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error("log failed");
      }),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  await expect(
    startDeployment({
      target: "router",
      operationId: "op",
      connect: jest.fn().mockResolvedValue(client),
      close: jest.fn().mockRejectedValue(new Error("close failed")),
      exec: jest.fn(),
      log,
      getClient: () => client,
      setClient: jest.fn(),
    }),
  ).rejects.toThrow("log failed");
  expect(log.warn).toHaveBeenCalledWith(
    "VyOps cleanup warning: SSH close failed after setup error: close failed",
  );
});
