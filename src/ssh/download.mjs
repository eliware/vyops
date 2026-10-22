import { log } from "@eliware/common";
import { randomUUID } from "node:crypto";
import { operationTimeout, transferWithTimeout } from "./transfer-timeout.mjs";

export function download(client, remote, local) {
  const operation = randomUUID();
  log.debug(`[vyops] SFTP download [${operation}]: ${remote} -> ${local}`);
  return transferWithTimeout(
    client.download({
      remotePath: remote,
      localPath: local,
      timeout: operationTimeout(),
    }),
    "download",
    operation,
    client,
    remote,
  );
}
