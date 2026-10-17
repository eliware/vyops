import { log } from "@eliware/common";
import { randomUUID } from "node:crypto";
import { commandSummary } from "./command-summary.mjs";

const timeout = (name, fallback) =>
  Number.isFinite(Number(process.env[name])) && Number(process.env[name]) > 0
    ? Number(process.env[name])
    : fallback;

function context(client) {
  return `deployment=${client?.__vyopsDeploymentId || "unknown"} target=${client?.__vyopsTarget || "unknown"} phase=${client?.__vyopsPhase || "unknown"}`;
}

function timeoutError(message, _client) {
  const error = new Error(message);
  error.code = "VYOPS_TIMEOUT";
  return error;
}

export async function exec(client, command) {
  const operation = randomUUID();
  log.debug(`[vyops] SSH exec [${operation}]: ${commandSummary(command)}`);
  try {
    const [result] = await client.exec([command], {
      commandTimeout: timeout("VYOPS_OPERATION_TIMEOUT", 60000),
    });
    log.debug(
      `[vyops] SSH exec [${operation}] complete. code=${result.code}. output=${(result.stdout || "").length + (result.stderr || "").length} bytes`,
    );
    return result;
  } catch (error) {
    if (error.code === "SSH_TIMEOUT") {
      throw timeoutError(
        `SSH command timed out [${operation}] (${context(client)}): ${commandSummary(command)}`,
      );
    }
    throw error;
  }
}
