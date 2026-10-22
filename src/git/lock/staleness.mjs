import { promises as fs } from "node:fs";
import { path } from "@eliware/common";

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
  if (Number.isInteger(pid) && pid > 0) {
    try {
      process.kill(pid, 0);
      return false;
    } catch (error) {
      if (error.code === "EPERM") return false;
      if (error.code === "ESRCH") return true;
      return false;
    }
  }
  return force || Date.now() - stats.mtimeMs > LOCK_MAX_AGE;
}
