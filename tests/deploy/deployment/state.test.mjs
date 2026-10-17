const { createDeploymentState } = await import("../../../src/deploy/deployment/state.mjs");

test("tracks hook finalization and deployment commit for recovery", () => {
  const state = createDeploymentState();
  const finalizeHooks = async () => {};
  expect(state.recovery(finalizeHooks)).toEqual({
    finalizeHooks,
    hooksFinalized: false,
    deploymentCommitted: false,
  });
  state.markDeploymentCommitted();
  state.markHooksFinalized();
  expect(state.recovery(finalizeHooks)).toEqual({
    finalizeHooks,
    hooksFinalized: true,
    deploymentCommitted: true,
  });
});
