import { isIP } from "node:net";

export function isValidHost(host) {
  if (typeof host !== "string" || !host) return false;
  const bracketed = host.startsWith("[") && host.endsWith("]");
  const address = bracketed ? host.slice(1, -1) : host;
  if (bracketed || address.includes(":")) return isIP(address) === 6;
  return /^[A-Za-z0-9._-]+$/.test(host);
}
