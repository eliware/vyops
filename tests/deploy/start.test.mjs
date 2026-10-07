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
