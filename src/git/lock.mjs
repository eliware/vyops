import { promises as fs } from "node:fs";
import { path } from "@eliware/common";
const LOCK_MAX_AGE = 60 * 60 * 1000;

async function staleLock(lock) {
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
  return Date.now() - stats.mtimeMs > LOCK_MAX_AGE;
}

export async function withRepositoryLock(repo, action, force) {
  const lock = path(repo, ".git", "vyops-pushback.lock");
  try {
    await fs.mkdir(lock);
  } catch (error) {
    if (error.code !== "EEXIST" || (!force && !(await staleLock(lock)))) {
      if (error.code === "EEXIST") throw new Error("another pushback is already running");
      throw error;
    }
    await fs.rm(lock, { recursive: true, force: true });
    await fs.mkdir(lock);
  }
  try {
    await fs.writeFile(path(lock, "owner"), `${process.pid}\n`, "utf8");
    return await action();
  } finally {
    await fs.rm(lock, { recursive: true, force: true });
  }
}
