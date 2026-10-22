import { log } from "@eliware/common";
import { randomUUID } from "node:crypto";
import { operationTimeout, transferWithTimeout } from "./transfer-timeout.mjs";

export async function upload(client, local, remote, mode = 0o600) {
  const operation = randomUUID();
  log.debug(`[vyops] SFTP upload [${operation}]: ${local} -> ${remote}`);
  return transferWithTimeout(
    client.upload({
      localPath: local,
      remotePath: remote,
      mode,
      timeout: operationTimeout(),
    }),
    "upload",
    operation,
    client,
    remote,
  );
}
