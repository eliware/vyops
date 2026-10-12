import { backup } from "../backup.mjs";

export async function runBackup(args, log) {
  log.debug(`[vyops] backup: starting for ${args.target}; destination=${args.config}`);
  await backup({ ...args, log });
  log.info(`Backup successful: ${args.config}`);
}
