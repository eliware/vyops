import { connectTimeout } from "./timeouts/connect.mjs";
import { authenticationOptions } from "./connection/authentication.mjs";
import { hostVerificationOptions } from "./connection/host-verification.mjs";

export function createConnectionOptions({ host, username, password }, environment = process.env) {
  return {
    host,
    username,
    ...authenticationOptions({ password }, environment),
    ...hostVerificationOptions(environment),
    connectTimeout: connectTimeout(environment),
  };
}
