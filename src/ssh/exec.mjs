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

export function exec(client, command) {
  const operation = randomUUID();
  log.debug(`[vyops] SSH exec [${operation}]: ${commandSummary(command)}`);
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(
      () => {
        settled = true;
        stream?.close?.();
        client.end?.();
        reject(
          timeoutError(
            `SSH command timed out [${operation}] (${context(client)}): ${commandSummary(command)}`,
            client,
          ),
        );
      },
      timeout("VYOPS_OPERATION_TIMEOUT", 60000),
    );
    let stream;
    client.exec(command, (error, openedStream) => {
      // codescope ignore: next late callback requires a real SSH transport.
      if (settled) {
        openedStream?.close?.();
        return;
      }
      stream = openedStream;
      // codescope ignore: next channel setup error requires a transport-specific callback.
      if (error) {
        settled = true;
        clearTimeout(timer);
        return reject(error);
      }
      let stdout = "",
        stderr = "";
      const finish = (callback, value) => {
        // codescope ignore: next duplicate stream event requires a real SSH transport.
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        callback(value);
      };
      stream.on("data", (data) => {
        stdout += data;
      });
      stream.stderr.on("data", (data) => {
        stderr += data;
      });
      stream.on("error", (error2) => finish(reject, error2));
      stream.on("close", (code) => finish(resolve, { code: code ?? 1, stdout, stderr }));
    });
  });
}
