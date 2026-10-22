import { jest } from "@jest/globals";
import {
  closeCleanupClient,
  getCleanupClient,
} from "../../../src/deploy/remote/cleanup-client.mjs";

test("reuses an open cleanup client", async () => {
  const client = { state: "open" };
  const connectClient = jest.fn();
  const close = jest.fn();
  await expect(getCleanupClient(client, connectClient, close, { warn: jest.fn() })).resolves.toBe(
    client,
  );
  expect(connectClient).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});

test("closes an inactive client and reconnects", async () => {
  const client = { state: "closed" };
  const recovery = { state: "open" };
  const close = jest.fn();
  const connectClient = jest.fn().mockResolvedValue(recovery);
  await expect(getCleanupClient(client, connectClient, close, { warn: jest.fn() })).resolves.toBe(
    recovery,
  );
  expect(close).toHaveBeenCalledWith(client);
  expect(connectClient).toHaveBeenCalledTimes(1);
});

test("logs a close warning before reconnecting", async () => {
  const log = { warn: jest.fn() };
  const recovery = {};
  const close = jest.fn().mockRejectedValue(new Error("close denied"));
  await expect(
    getCleanupClient({ state: "closed" }, jest.fn().mockResolvedValue(recovery), close, log),
  ).resolves.toBe(recovery);
  expect(log.warn).toHaveBeenCalledWith(
    "VyOps cleanup warning: closed SSH client close failed: close denied",
  );
});

test("returns a final client close error to the caller", async () => {
  const error = new Error("close denied");
  await expect(closeCleanupClient({}, jest.fn().mockRejectedValue(error))).resolves.toBe(error);
  await expect(closeCleanupClient(null, jest.fn())).resolves.toBeUndefined();
});
