import { promises as fs } from "node:fs";
import { path } from "@eliware/common";
import { staleLock } from "./lock/staleness.mjs";

export async function withRepositoryLock(repo, action, force) {
  const lock = path(repo, ".git", "vyops-pushback.lock");
  try {
    await fs.mkdir(lock);
  } catch (error) {
    if (error.code !== "EEXIST" || !(await staleLock(lock, force))) {
      if (error.code === "EEXIST") throw new Error("a pushback is in progress");
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
