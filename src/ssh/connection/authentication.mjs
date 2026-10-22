export function authenticationOptions({ password }, environment = process.env) {
  return {
    privateKeyPath:
      password === undefined && !environment.SSH_AUTH_SOCK
        ? environment.VYOPS_SSH_KEY || undefined
        : undefined,
    agent: environment.SSH_AUTH_SOCK,
    password,
  };
}
