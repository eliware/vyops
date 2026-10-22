import { promises as fs } from "node:fs";
import { path } from "@eliware/common";
import { isStaleOwner } from "./stale-owner.mjs";

const LOCK_MAX_AGE = 60 * 60 * 1000;

export async function staleLock(lock, force) {
  let owner;
  let stats;
  try {
    [owner, stats] = await Promise.all([fs.readFile(path(lock, "owner"), "utf8"), fs.stat(lock)]);
  } catch {
    return false;
  }
  const pid = Number.parseInt(owner.trim(), 10);
  if (Number.isInteger(pid) && pid > 0) return isStaleOwner(pid);
  return force || Date.now() - stats.mtimeMs > LOCK_MAX_AGE;
}
