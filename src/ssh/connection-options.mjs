import { connectTimeout } from "./timeouts/connect.mjs";

export function createConnectionOptions({ host, username, password }, environment = process.env) {
  return {
    host,
    username,
    privateKeyPath:
      password === undefined && !environment.SSH_AUTH_SOCK
        ? environment.VYOPS_SSH_KEY || undefined
        : undefined,
    agent: environment.SSH_AUTH_SOCK,
    knownHostsPath: environment.SSH_KNOWN_HOSTS || "~/.ssh/known_hosts",
    hostCaPath: environment.SSH_HOST_CA,
    password,
    connectTimeout: connectTimeout(environment),
  };
}
