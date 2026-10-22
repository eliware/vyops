import { authenticationOptions } from "../../../src/ssh/connection/authentication.mjs";

test("selects the configured private key when no agent or password exists", () => {
  expect(
    authenticationOptions({}, { VYOPS_SSH_KEY: "/keys/release", SSH_AUTH_SOCK: undefined }),
  ).toEqual({ privateKeyPath: "/keys/release", agent: undefined, password: undefined });
});

test("uses the SSH agent instead of the private key", () => {
  expect(
    authenticationOptions({}, { VYOPS_SSH_KEY: "/keys/release", SSH_AUTH_SOCK: "/tmp/agent" }),
  ).toEqual({ privateKeyPath: undefined, agent: "/tmp/agent", password: undefined });
});

test("uses a bootstrap password instead of the private key", () => {
  expect(authenticationOptions({ password: "secret" }, { VYOPS_SSH_KEY: "/keys/release" })).toEqual(
    { privateKeyPath: undefined, agent: undefined, password: "secret" },
  );
});

test("uses the process environment when no environment is passed", () => {
  const previousKey = process.env.VYOPS_SSH_KEY;
  const previousAgent = process.env.SSH_AUTH_SOCK;
  delete process.env.VYOPS_SSH_KEY;
  delete process.env.SSH_AUTH_SOCK;
  try {
    expect(authenticationOptions({})).toEqual({
      privateKeyPath: undefined,
      agent: undefined,
      password: undefined,
    });
  } finally {
    if (previousKey === undefined) delete process.env.VYOPS_SSH_KEY;
    else process.env.VYOPS_SSH_KEY = previousKey;
    if (previousAgent === undefined) delete process.env.SSH_AUTH_SOCK;
    else process.env.SSH_AUTH_SOCK = previousAgent;
  }
});
