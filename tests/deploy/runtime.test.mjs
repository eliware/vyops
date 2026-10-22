import { jest } from "@jest/globals";
import { createDeploymentRuntime } from "../../src/deploy/runtime.mjs";

test("creates client state and passes deployment dependencies to startup", async () => {
  const client = {};
  const dependencies = { connect: jest.fn(), close: jest.fn(), exec: jest.fn() };
  const runtimeValues = { runId: "run", redact: jest.fn(), debugLog: jest.fn() };
  const start = jest.fn(async ({ setClient }) => {
    setClient(client);
    return runtimeValues;
  });
  const runtime = await createDeploymentRuntime(
    { target: "vyos@router", password: "secret", operationId: "operation" },
    start,
    dependencies,
  );

  expect(start).toHaveBeenCalledWith({
    target: "vyos@router",
    password: "secret",
    operationId: "operation",
    ...dependencies,
    getClient: expect.any(Function),
    setClient: expect.any(Function),
  });
  expect(runtime.getClient()).toBe(client);
  expect(runtime).toMatchObject({ client, dependencies, ...runtimeValues });
  runtime.setClient(null);
  expect(runtime.getClient()).toBeNull();
});
