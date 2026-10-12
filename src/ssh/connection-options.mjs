export function createConnectionOptions({ host, username, password }, environment = process.env) {
  const configuredTimeout = Number(environment.VYOPS_CONNECT_TIMEOUT);
  return {
    host,
    username,
    privateKeyPath: password === undefined ? environment.VYOPS_SSH_KEY || undefined : undefined,
    agent: environment.SSH_AUTH_SOCK,
    knownHostsPath: environment.SSH_KNOWN_HOSTS || "~/.ssh/known_hosts",
    hostCaPath: environment.SSH_HOST_CA,
    password,
    connectTimeout:
      Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 30000,
  };
}
