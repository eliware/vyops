export function timeoutContext(client) {
  return `deployment=${client?.__vyopsDeploymentId || "unknown"} target=${client?.__vyopsTarget || "unknown"} phase=${client?.__vyopsPhase || "unknown"}`;
}

export function timeoutError(message) {
  const error = new Error(message);
  error.code = "VYOPS_TIMEOUT";
  return error;
}
