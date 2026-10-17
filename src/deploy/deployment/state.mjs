export function createDeploymentState() {
  let hooksFinalized = false;
  let deploymentCommitted = false;
  return {
    markHooksFinalized() {
      hooksFinalized = true;
    },
    markDeploymentCommitted() {
      deploymentCommitted = true;
    },
    recovery(finalizeHooks) {
      return { finalizeHooks, hooksFinalized, deploymentCommitted };
    },
  };
}
