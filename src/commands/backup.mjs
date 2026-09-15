import { backup } from '../backup.mjs';

export async function runBackup(args, log) {
  await backup(args);
  log.info(`Backup successful: ${args.config}`);
}
