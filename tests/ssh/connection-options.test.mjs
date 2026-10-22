const { createConnectionOptions } = await import("../../src/ssh/connection-options.mjs");

test("assembles SSH options from the focused settings modules", () => {
  expect(createConnectionOptions({ host: "router", username: "vyos" }, {})).toEqual({
    host: "router",
    username: "vyos",
    privateKeyPath: undefined,
    agent: undefined,
    password: undefined,
    knownHostsPath: "~/.ssh/known_hosts",
    hostCaPath: undefined,
    connectTimeout: 30000,
  });
});
