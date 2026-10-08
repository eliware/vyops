import { fs, path, log } from "@eliware/common";
import { randomUUID } from "node:crypto";
import { parse, resolve } from "node:path";
import { close, connect, parseTarget } from "./ssh.mjs";
import { exec } from "./ssh/exec.mjs";
import { download } from "./ssh/download.mjs";
import {
  remoteScriptPath,
  shellQuote,
  snapshotRemoteScript,
  validateRemoteScript,
} from "./backup/remote-script.mjs";
import { publishBackup } from "./backup/publish-backup.mjs";

export async function backup({ target, config, password }) {
  parseTarget(target);
  const destination = resolve(config);
  if (destination === parse(destination).root)
    throw new Error("backup destination must not be a filesystem root");
  const client =
    password === undefined ? await connect(target) : await connect(target, { password });
  try {
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
    for (const name of files) await validateRemoteScript(exec, client, `/config/scripts/${name}`);
    const stagedBackup = path(config, "..", `.vyops-backup-${randomUUID()}`);
    const previousBackup = path(config, "..", `.vyops-backup-old-${randomUUID()}`);
    const stagedScripts = path(stagedBackup, "scripts");
    await fs.promises.mkdir(path(config, ".."), { recursive: true });
    await fs.promises.mkdir(stagedBackup, { mode: 0o700 });
    await fs.promises.mkdir(stagedScripts, { mode: 0o700 });
    try {
      const stagedConfig = path(stagedBackup, "config.boot");
      await download(client, "/config/config.boot", stagedConfig);
      await fs.promises.chmod(stagedConfig, 0o600);
      for (const name of files) {
        const remote = `/config/scripts/${name}`;
        const snapshotDirectory = `/tmp/.vyops-backup.${randomUUID()}`;
        const snapshot = `${snapshotDirectory}/script`;
        const local = path(stagedScripts, name);
        await snapshotRemoteScript(exec, client, remote, snapshotDirectory);
        try {
          await fs.promises.mkdir(path(local, ".."), { recursive: true, mode: 0o700 });
          await download(client, snapshot, local);
          await fs.promises.chmod(local, 0o600);
        } finally {
          await exec(client, `rm -rf -- ${shellQuote(snapshotDirectory)}`);
        }
        log.debug(`[vyops] backed up script: ${name}`);
      }
      const manifest = ["kind\tpath", ...files.map((name) => `file\t${name}`)].join("\n") + "\n";
      await fs.promises.writeFile(path(stagedBackup, "config.boot.manifest.tsv"), manifest, {
        encoding: "utf8",
        mode: 0o600,
      });
      await publishBackup(fs.promises, stagedBackup, config, previousBackup);
    } finally {
      await fs.promises.rm(stagedBackup, { recursive: true, force: true });
    }
    return 0;
  } finally {
    await close(client);
  }
}
