import { timeoutContext, timeoutError } from "../../../src/ssh/timeout/context.mjs";

test("formats deployment metadata and unknown context", () => {
  expect(
    timeoutContext({
      __vyopsDeploymentId: "deploy",
      __vyopsTarget: "router",
      __vyopsPhase: "upload",
    }),
  ).toBe("deployment=deploy target=router phase=upload");
  expect(timeoutContext({})).toBe("deployment=unknown target=unknown phase=unknown");
});

test("creates a VyOps timeout error", () => {
  expect(timeoutError("command timed out")).toMatchObject({
    message: "command timed out",
    code: "VYOPS_TIMEOUT",
  });
});
