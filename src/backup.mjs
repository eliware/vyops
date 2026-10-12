import { fs, path, log as defaultLog } from "@eliware/common";
import { randomUUID } from "node:crypto";
import { parse, resolve } from "node:path";
import { close, connect, parseTarget } from "./ssh.mjs";
import { exec } from "./ssh/exec.mjs";
import { download } from "./ssh/download.mjs";
import { remoteScriptPath, validateRemoteScript } from "./backup/remote-script.mjs";
import { publishBackup } from "./backup/publish-backup.mjs";
import { stageBackup } from "./backup/stage-backup.mjs";

export async function backup({ target, config, password, log = defaultLog }) {
  parseTarget(target);
  const destination = resolve(config);
  if (destination === parse(destination).root)
    throw new Error("backup destination must not be a filesystem root");
  const client =
    password === undefined ? await connect(target) : await connect(target, { password });
  try {
    log.debug("[vyops] backup: inspecting remote script links");
    const links = await exec(client, "find -P /config/scripts -type l -print0 2>/dev/null");
    // codescope ignore: next remote inspection failure requires a live router.
    if (links.code !== 0)
      throw new Error(`could not inspect remote scripts: ${links.stderr || links.stdout}`.trim());
    // codescope ignore: next symlink discovery requires a live remote filesystem.
    if (links.stdout) {
      // codescope ignore: next symlink discovery requires a live remote filesystem.
      const first = links.stdout.split("\0").filter(Boolean)[0];
      throw new Error(`remote script symlink rejected: ${first}`);
    }
    const result = await exec(client, "find -P /config/scripts -type f -print0 2>/dev/null");
    if (result.code !== 0)
      throw new Error(`could not list remote scripts: ${result.stderr || result.stdout}`.trim());
    // NUL records preserve valid embedded whitespace in remote filenames.
    const files = result.stdout.split("\0").filter(Boolean).map(remoteScriptPath);
    log.debug(`[vyops] backup: found ${files.length} remote script files`);
    for (const name of files) await validateRemoteScript(exec, client, `/config/scripts/${name}`);
    const previousBackup = path(config, "..", `.vyops-backup-old-${randomUUID()}`);
    const stagedBackup = path(config, "..", `.vyops-backup-${randomUUID()}`);
    try {
      await stageBackup({
        fs: fs.promises,
        path,
        client,
        staged: stagedBackup,
        files,
        download,
        exec,
        log,
      });
      await publishBackup(fs.promises, stagedBackup, config, previousBackup);
      log.debug("[vyops] backup: published configuration, scripts, and manifest");
    } finally {
      await fs.promises.rm(stagedBackup, { recursive: true, force: true });
    }
    return 0;
  } finally {
    log.debug("[vyops] backup: closing SSH connection");
    await close(client);
  }
}
