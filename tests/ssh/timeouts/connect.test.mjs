import { connectTimeout } from "../../../src/ssh/timeouts/connect.mjs";

test.each([
  [{ VYOPS_CONNECT_TIMEOUT: "1234" }, 1234],
  [{}, 30000],
  [{ VYOPS_CONNECT_TIMEOUT: "0" }, 30000],
  [{ VYOPS_CONNECT_TIMEOUT: "invalid" }, 30000],
  [{ VYOPS_CONNECT_TIMEOUT: "Infinity" }, 30000],
])("reads connection timeout from %p", (environment, expected) => {
  expect(connectTimeout(environment)).toBe(expected);
});

test("uses the process environment when no environment is passed", () => {
  const previous = process.env.VYOPS_CONNECT_TIMEOUT;
  delete process.env.VYOPS_CONNECT_TIMEOUT;
  try {
    expect(connectTimeout()).toBe(30000);
  } finally {
    if (previous === undefined) delete process.env.VYOPS_CONNECT_TIMEOUT;
    else process.env.VYOPS_CONNECT_TIMEOUT = previous;
  }
});
