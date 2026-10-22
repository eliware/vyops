export function operationTimeout() {
  const value = Number(process.env.VYOPS_OPERATION_TIMEOUT);
  return Number.isFinite(value) && value > 0 ? value : 60000;
}

function context(client) {
  return `deployment=${client?.__vyopsDeploymentId || "unknown"} target=${client?.__vyopsTarget || "unknown"} phase=${client?.__vyopsPhase || "unknown"}`;
}

export function transferWithTimeout(transfer, action, operation, client, remote) {
  return Promise.resolve(transfer).catch((error) => {
    if (error.code === "SSH_TIMEOUT" || error.code === "SSH_TRANSFER_TIMEOUT") {
      const timeout = new Error(
        `SFTP ${action} timed out [${operation}] (${context(client)}): ${remote}`,
      );
      timeout.code = "VYOPS_TIMEOUT";
      throw timeout;
    }
    throw error;
  });
}
