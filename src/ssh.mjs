import { connect as establishConnection } from "./ssh/connection.mjs";

export { parseTarget } from "./ssh/target.mjs";

// codescope ignore: next environment-specific timeout overrides are integration configuration.
const CLOSE_TIMEOUT = 5000;

export async function connect(target, options = {}) {
  return establishConnection(target, {
    ...options,
    register: (client) => activeClients.add(client),
  });
}

const activeClients = new Set();

export function close(client) {
  if (!client) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeClients.delete(client);
      resolve();
    };
    timer = setTimeout(done, CLOSE_TIMEOUT);
    try {
      client.once("close", done);
      client.once("error", done);
      client.end();
    } catch {
      done();
    }
  });
}

export async function closeAll() {
  await Promise.all([...activeClients].map((client) => close(client)));
}
