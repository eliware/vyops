import { log } from "@eliware/common";
import { randomUUID } from "node:crypto";

const timeout = (name, fallback) =>
  Number.isFinite(Number(process.env[name])) && Number(process.env[name]) > 0
    ? Number(process.env[name])
    : fallback;

function context(client) {
  return `deployment=${client?.__vyopsDeploymentId || "unknown"} target=${client?.__vyopsTarget || "unknown"} phase=${client?.__vyopsPhase || "unknown"}`;
}

function timeoutError(message) {
  const error = new Error(message);
  error.code = "VYOPS_TIMEOUT";
  return error;
}

export function download(client, remote, local) {
  const operation = randomUUID();
  log.debug(`[vyops] SFTP download [${operation}]: ${remote} -> ${local}`);
  return client
    .download({
      remotePath: remote,
      localPath: local,
      timeout: timeout("VYOPS_OPERATION_TIMEOUT", 60000),
    })
    .catch((error) => {
      if (error.code === "SSH_TIMEOUT" || error.code === "SSH_TRANSFER_TIMEOUT") {
        throw timeoutError(
          `SFTP download timed out [${operation}] (${context(client)}): ${remote}`,
        );
      }
      throw error;
    });
}
