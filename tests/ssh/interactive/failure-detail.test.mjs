import { interactiveFailureDetail } from "../../../src/ssh/interactive/failure-detail.mjs";

test("keeps bounded failure detail and redacts key values", () => {
  expect(interactiveFailureDetail('failed private key "secret"')).toBe(
    'failed private key "[redacted]"',
  );
  expect(interactiveFailureDetail("ordinary output")).toBeUndefined();
  expect(interactiveFailureDetail(`error ${"x".repeat(300)}`)).toHaveLength(240);
});
