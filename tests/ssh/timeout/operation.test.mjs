import { operationTimeout } from "../../../src/ssh/timeout/operation.mjs";

afterEach(() => {
  delete process.env.VYOPS_OPERATION_TIMEOUT;
});

test("uses a valid operation timeout and defaults invalid values", () => {
  process.env.VYOPS_OPERATION_TIMEOUT = "321";
  expect(operationTimeout()).toBe(321);
  for (const value of ["bad", "0", "-1", "Infinity"]) {
    process.env.VYOPS_OPERATION_TIMEOUT = value;
    expect(operationTimeout()).toBe(60000);
  }
});
