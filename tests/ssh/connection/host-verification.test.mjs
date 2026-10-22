import { hostVerificationOptions } from "../../../src/ssh/connection/host-verification.mjs";

test("uses configured host trust files", () => {
  expect(
    hostVerificationOptions({
      SSH_KNOWN_HOSTS: "/keys/known_hosts",
      SSH_HOST_CA: "/keys/ca",
    }),
  ).toEqual({ knownHostsPath: "/keys/known_hosts", hostCaPath: "/keys/ca" });
});

test("uses the default known hosts file", () => {
  expect(hostVerificationOptions({})).toEqual({
    knownHostsPath: "~/.ssh/known_hosts",
    hostCaPath: undefined,
  });
});

test("uses the process environment when no environment is passed", () => {
  const previousHosts = process.env.SSH_KNOWN_HOSTS;
  const previousCa = process.env.SSH_HOST_CA;
  delete process.env.SSH_KNOWN_HOSTS;
  delete process.env.SSH_HOST_CA;
  try {
    expect(hostVerificationOptions()).toEqual({
      knownHostsPath: "~/.ssh/known_hosts",
      hostCaPath: undefined,
    });
  } finally {
    if (previousHosts === undefined) delete process.env.SSH_KNOWN_HOSTS;
    else process.env.SSH_KNOWN_HOSTS = previousHosts;
    if (previousCa === undefined) delete process.env.SSH_HOST_CA;
    else process.env.SSH_HOST_CA = previousCa;
  }
});
