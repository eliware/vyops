import { log } from "@eliware/common";
import { connect as sharedConnect } from "@eliware/ssh-client";
import { parseTarget } from "./target.mjs";
import { createConnectionOptions } from "./connection-options.mjs";

export async function connect(target, { password, register = () => {} } = {}) {
  const { username, host } = parseTarget(target);
  log.debug(`[vyops] SSH connecting: ${username}@${host}`);
  const connection = await sharedConnect(createConnectionOptions({ host, username, password }));
  connection.__vyopsTarget = target;
  connection.__vyopsPhase = "connect";
  register(connection);
  log.debug(`[vyops] SSH connected: ${username}@${host}`);
  return connection;
}
