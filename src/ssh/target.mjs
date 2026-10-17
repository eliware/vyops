import { isValidHost } from "./host-validation.mjs";

export function parseTarget(target) {
  if (typeof target !== "string" || !target || /\s/.test(target)) {
    throw new Error("invalid target. Use user@host.");
  }
  const at = target.indexOf("@");
  if (at <= 0 || at !== target.lastIndexOf("@") || at === target.length - 1) {
    throw new Error("invalid target. Use user@host.");
  }
  const username = target.slice(0, at);
  const host = target.slice(at + 1);
  if (!/^[A-Za-z0-9._-]+$/.test(username) || !isValidHost(host)) {
    throw new Error("invalid target. Use user@host.");
  }
  return { username, host };
}
