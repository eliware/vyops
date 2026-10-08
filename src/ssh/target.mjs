import { isIP } from "node:net";

export function parseTarget(target) {
  if (typeof target !== "string" || !target || /\s/.test(target)) {
    throw new Error("invalid target; expected user@host");
  }
  const at = target.indexOf("@");
  if (at <= 0 || at !== target.lastIndexOf("@") || at === target.length - 1) {
    throw new Error("invalid target; expected user@host");
  }
  const username = target.slice(0, at);
  const host = target.slice(at + 1);
  const address = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  const validHost =
    (host.startsWith("[") && host.endsWith("]")) || address.includes(":")
      ? isIP(address) === 6
      : /^[A-Za-z0-9._-]+$/.test(host);
  if (!/^[A-Za-z0-9._-]+$/.test(username) || !validHost) {
    throw new Error("invalid target; expected user@host");
  }
  return { username, host };
}
