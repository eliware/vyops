export function hostVerificationOptions(environment = process.env) {
  return {
    knownHostsPath: environment.SSH_KNOWN_HOSTS || "~/.ssh/known_hosts",
    hostCaPath: environment.SSH_HOST_CA,
  };
}
