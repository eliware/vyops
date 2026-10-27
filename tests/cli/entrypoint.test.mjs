import { jest } from "@jest/globals";
import { runCliEntrypoint } from "../../src/cli/entrypoint.mjs";

const makeLifecycle = () => {
  const log = { error: jest.fn() };
  const errors = { removeHandlers: jest.fn() };
  const signals = { removeHandlers: jest.fn() };
  const registerHandlers = jest.fn(() => errors);
  const registerSignals = jest.fn(() => signals);
  const closeAll = jest.fn();
  const cleanup = jest.fn();
  return { log, errors, signals, registerHandlers, registerSignals, closeAll, cleanup };
};

test("runs the command and finishes the registered lifecycle", async () => {
  const context = makeLifecycle();
  const run = jest.fn();
  await runCliEntrypoint({ ...context, run });
  expect(run).toHaveBeenCalled();
  expect(context.closeAll).toHaveBeenCalled();
  expect(context.signals.removeHandlers).toHaveBeenCalled();
  expect(context.errors.removeHandlers).toHaveBeenCalled();
});

test("reports command and lifecycle failures", async () => {
  const context = makeLifecycle();
  const run = jest.fn().mockRejectedValue(new Error("command failed"));
  context.closeAll.mockRejectedValue(new Error("close failed"));
  const originalExitCode = process.exitCode;
  process.exitCode = 0;
  try {
    await runCliEntrypoint({ ...context, run });
    expect(context.log.error).toHaveBeenNthCalledWith(1, "command failed");
    expect(context.log.error).toHaveBeenNthCalledWith(2, "close failed");
    expect(process.exitCode).toBe(1);
    expect(context.signals.removeHandlers).toHaveBeenCalled();
    expect(context.errors.removeHandlers).toHaveBeenCalled();
  } finally {
    process.exitCode = originalExitCode;
  }
});
