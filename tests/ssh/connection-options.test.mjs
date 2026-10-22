const { createConnectionOptions } = await import("../../src/ssh/connection-options.mjs");

test("builds key and host verification options", () => {
  expect(
    createConnectionOptions(
      { host: "router", username: "vyos" },
      {
        VYOPS_SSH_KEY: "/keys/release",
        SSH_AUTH_SOCK: "/tmp/agent",
        SSH_KNOWN_HOSTS: "/keys/known_hosts",
        SSH_HOST_CA: "/keys/ca",
      },
    ),
  ).toMatchObject({
    host: "router",
    username: "vyos",
    privateKeyPath: undefined,
    agent: "/tmp/agent",
    knownHostsPath: "/keys/known_hosts",
    hostCaPath: "/keys/ca",
    password: undefined,
  });
});

test("uses default host verification options when no environment values exist", () => {
  expect(createConnectionOptions({ host: "router", username: "vyos" }, {})).toMatchObject({
    privateKeyPath: undefined,
    knownHostsPath: "~/.ssh/known_hosts",
  });
  expect(
    createConnectionOptions(
      { host: "router", username: "vyos", password: "secret" },
      { VYOPS_SSH_KEY: "/keys/release" },
    ),
  ).toMatchObject({ privateKeyPath: undefined, password: "secret" });
});
