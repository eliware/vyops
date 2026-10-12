import { createConnectionOptions } from "../../src/ssh/connection-options.mjs";

test("builds key and host verification options", () => {
  expect(
    createConnectionOptions(
      { host: "router", username: "vyos" },
      {
        VYOPS_SSH_KEY: "/keys/release",
        SSH_AUTH_SOCK: "/tmp/agent",
        SSH_KNOWN_HOSTS: "/keys/known_hosts",
        SSH_HOST_CA: "/keys/ca",
        VYOPS_CONNECT_TIMEOUT: "1234",
      },
    ),
  ).toEqual({
    host: "router",
    username: "vyos",
    privateKeyPath: "/keys/release",
    agent: "/tmp/agent",
    knownHostsPath: "/keys/known_hosts",
    hostCaPath: "/keys/ca",
    password: undefined,
    connectTimeout: 1234,
  });
});

test("uses defaults for missing and invalid timeout values", () => {
  expect(createConnectionOptions({ host: "router", username: "vyos" }, {})).toMatchObject({
    privateKeyPath: undefined,
    knownHostsPath: "~/.ssh/known_hosts",
    connectTimeout: 30000,
  });
  expect(
    createConnectionOptions(
      { host: "router", username: "vyos", password: "secret" },
      { VYOPS_SSH_KEY: "/keys/release", VYOPS_CONNECT_TIMEOUT: "0" },
    ),
  ).toMatchObject({ privateKeyPath: undefined, password: "secret", connectTimeout: 30000 });
  expect(
    createConnectionOptions(
      { host: "router", username: "vyos" },
      { VYOPS_CONNECT_TIMEOUT: "invalid" },
    ).connectTimeout,
  ).toBe(30000);
});
