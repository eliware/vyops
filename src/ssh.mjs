import { connect as establishConnection } from "./ssh/connection.mjs";

export { parseTarget } from "./ssh/target.mjs";

export async function connect(target, options = {}) {
  return establishConnection(target, {
    ...options,
    register: (client) => activeClients.add(client),
  });
}

const activeClients = new Set();

export function close(client) {
  if (!client) return Promise.resolve();
  return Promise.resolve()
    .then(() => client.close())
    .finally(() => activeClients.delete(client));
}

export async function closeAll() {
  await Promise.all([...activeClients].map((client) => close(client)));
}
