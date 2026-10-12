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

export async function upload(client, local, remote, mode = 0o600) {
  const operation = randomUUID();
  log.debug(`[vyops] SFTP upload [${operation}]: ${local} -> ${remote}`);
  try {
    await client.upload({
      localPath: local,
      remotePath: remote,
      mode,
      timeout: timeout("VYOPS_OPERATION_TIMEOUT", 60000),
    });
  } catch (error) {
    if (error.code === "SSH_TIMEOUT" || error.code === "SSH_TRANSFER_TIMEOUT") {
      throw timeoutError(`SFTP upload timed out [${operation}] (${context(client)}): ${remote}`);
    }
    throw error;
  }
}
