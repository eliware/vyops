import { log } from "@eliware/common";
import { randomUUID } from "node:crypto";
import { commandSummary } from "./command-summary.mjs";
import { operationTimeout } from "./timeout/operation.mjs";
import { timeoutContext, timeoutError } from "./timeout/context.mjs";

export async function exec(client, command) {
  const operation = randomUUID();
  log.debug(`[vyops] SSH exec [${operation}]: ${commandSummary(command)}`);
  try {
    const [result] = await client.exec([command], {
      commandTimeout: operationTimeout(),
    });
    log.debug(
      `[vyops] SSH exec [${operation}] complete. code=${result.code}. output=${(result.stdout || "").length + (result.stderr || "").length} bytes`,
    );
    return result;
  } catch (error) {
    if (error.code === "SSH_TIMEOUT") {
      throw timeoutError(
        `SSH command timed out [${operation}] (${timeoutContext(client)}): ${commandSummary(command)}`,
      );
    }
    throw error;
  }
}
