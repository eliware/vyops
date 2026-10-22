import { operationTimeout } from "./timeout/operation.mjs";
import { timeoutContext, timeoutError } from "./timeout/context.mjs";

export { operationTimeout };

export function transferWithTimeout(transfer, action, operation, client, remote) {
  return Promise.resolve(transfer).catch((error) => {
    if (error.code === "SSH_TIMEOUT" || error.code === "SSH_TRANSFER_TIMEOUT") {
      throw timeoutError(
        `SFTP ${action} timed out [${operation}] (${timeoutContext(client)}): ${remote}`,
      );
    }
    throw error;
  });
}
