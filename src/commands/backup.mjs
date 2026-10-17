import { backup } from "../backup.mjs";

export async function runBackup(args, log) {
  log.debug(`[vyops] backup: target=${args.target}, destination=${args.config}`);
  await backup({ ...args, log });
  log.info(`Backup complete: ${args.config}`);
}
