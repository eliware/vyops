import { jest } from "@jest/globals";
const { registerCliLifecycle } = await import("../../src/cli/lifecycle.mjs");

test("registers shutdown work and removes process handlers", async () => {
  const errors = { removeHandlers: jest.fn() };
  const signals = { removeHandlers: jest.fn() };
  const closeAll = jest.fn();
  const cleanup = jest.fn();
  const registerHandlers = jest.fn(() => errors);
  const registerSignals = jest.fn(() => signals);
  const lifecycle = registerCliLifecycle({
    log: {},
    registerHandlers,
    registerSignals,
    closeAll,
    cleanup,
  });
  await registerSignals.mock.calls[0][0].shutdownHook();
  expect(closeAll).toHaveBeenCalledTimes(1);
  expect(cleanup).toHaveBeenCalledTimes(1);
  await lifecycle.finish();
  expect(signals.removeHandlers).toHaveBeenCalledTimes(1);
  expect(errors.removeHandlers).toHaveBeenCalledTimes(1);
});

test("removes process handlers when SSH close fails", async () => {
  const errors = { removeHandlers: jest.fn() };
  const signals = { removeHandlers: jest.fn() };
  const lifecycle = registerCliLifecycle({
    log: {},
    registerHandlers: jest.fn(() => errors),
    registerSignals: jest.fn(() => signals),
    closeAll: jest.fn().mockRejectedValue(new Error("SSH close failed")),
    cleanup: jest.fn(),
  });
  await expect(lifecycle.finish()).rejects.toThrow("SSH close failed");
  expect(signals.removeHandlers).toHaveBeenCalledTimes(1);
  expect(errors.removeHandlers).toHaveBeenCalledTimes(1);
});
