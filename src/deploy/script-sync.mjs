import { join } from 'node:path';
import { posix as posixPath } from 'node:path';
import { readFile as readLocalFile } from 'node:fs/promises';
import { fs, path as eliwarePath, log } from '@eliware/common';
import { exec, upload } from '../ssh.mjs';
import { listScripts } from './script-tree.mjs';
import { finalizeScripts, rollbackScripts } from './script-rollback.mjs';
import { readManagedPaths, unmanagedPaths } from './script-manifest.mjs';
import { localScriptMetadata } from './script-validation.mjs';

export async function installScripts(client, config, debugLog, runId, verifyBinaries, redact = value => value) {
  const scriptsDir = eliwarePath(config, '..', 'scripts');
  let names;
  try {
    names = await listScripts(fs, eliwarePath, scriptsDir);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (names.some(name => !name || name === '.' || name === '..' || name.startsWith('/') || name.split('/').includes('..') || !/^[A-Za-z0-9._/-]+$/.test(name))) {
    throw new Error('script path is invalid');
  }
  const remoteDir = `/home/vyos/.scripts.${runId}`;
  const backupDir = `/home/vyos/.scripts-backup.${runId}`;
  const manifest = `${remoteDir}/manifest.tsv`;
  const installDir = '/config/scripts';
  const previousManifest = `${config}.manifest.tsv`;
  let previouslyManaged;
  try {
    previouslyManaged = await readManagedPaths(readLocalFile, previousManifest);
    const live = await exec(client, "find -P /config/scripts -type f -print0 2>/dev/null");
    if (live.code !== 0) throw new Error(live.stderr || live.stdout || 'live script inspection failed');
    const unmanaged = unmanagedPaths(live.stdout, previouslyManaged);
    if (unmanaged.length) log.warn(`live router has unmanaged script files (${unmanaged.join(', ')}); run a fresh backup before relying on rollback`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`live script inspection failed: ${error.message}`);
  }
  if (!names.length) return null;
  const made = await exec(client, `mkdir -m 700 ${JSON.stringify(remoteDir)} ${JSON.stringify(backupDir)} && sudo mkdir -p ${JSON.stringify(installDir)} && printf '%s\\n' 'kind\\tpath\\tpreexisting\\told_mode\\told_sha256\\told_type\\tnew_mode\\tnew_sha256\\tnew_type' > ${JSON.stringify(manifest)}`);
  if (made.code !== 0) throw new Error(`script directory setup failed: ${made.stderr || made.stdout}`.trim());
  const staged = [];
  try {
    for (const name of names) {
      const local = eliwarePath(scriptsDir, name);
      const remote = `${remoteDir}/${name}`;
      const installed = `${installDir}/${name}`;
      const backup = `${backupDir}/${name}`;
      const parent = posixPath.dirname(name);
      const { mode, executable, binary, localHash } = await localScriptMetadata(readLocalFile, fs.promises.stat, scriptsDir, name);
      const ancestors = parent === '.' ? [] : parent.split('/').map((_, index, parts) => parts.slice(0, index + 1).join('/'));
      const directoryMetadata = ancestors.map(directory => `if ! sudo awk -F '\\t' -v p=${JSON.stringify(directory)} '$1 == "directory" && $2 == p { found=1 } END { exit found ? 0 : 1 }' ${JSON.stringify(manifest)}; then if sudo test -d ${JSON.stringify(`${installDir}/${directory}`)}; then dirPreexisting=true; dirMode=$(sudo stat -c %a ${JSON.stringify(`${installDir}/${directory}`)}); dirType=$(sudo stat -c %F ${JSON.stringify(`${installDir}/${directory}`)}); else dirPreexisting=false; dirMode=-; dirType=-; fi; sudo mkdir -p ${JSON.stringify(`${installDir}/${directory}`)}; printf 'directory\\t%s\\t%s\\t%s\\t-\\t%s\\t%s\\t-\\tdirectory\\n' ${JSON.stringify(directory)} "$dirPreexisting" "$dirMode" "$dirType" "$(sudo stat -c %a ${JSON.stringify(`${installDir}/${directory}`)})" >> ${JSON.stringify(manifest)}; fi`).join('; ');
      const existingRecord = previouslyManaged.has(name) ? `sudo mkdir -p ${JSON.stringify(`${backupDir}/${parent}`)} && sudo cp -p -- ${JSON.stringify(installed)} ${JSON.stringify(backup)} && printf 'file\\t%s\\ttrue\\t%s\\t%s\\t%s\\t-\\t-\\t-\\n'` : `printf 'file\\t%s\\tunmanaged\\t-\\t-\\t-\\t-\\t-\\t-\\n'`;
      const backedUp = await exec(client, `${directoryMetadata}${directoryMetadata ? '; ' : ''}if sudo test -L ${JSON.stringify(installed)}; then echo 'destination is a symlink' >&2; exit 1; elif sudo test -e ${JSON.stringify(installed)}; then sudo test -f ${JSON.stringify(installed)} && test "$(sudo realpath -- ${JSON.stringify(installed)})" = ${JSON.stringify(installed)} && ${existingRecord} ${JSON.stringify(name)}${previouslyManaged.has(name) ? ` "$(sudo stat -c %a ${JSON.stringify(installed)})" "$(sudo sha256sum ${JSON.stringify(installed)} | awk '{print $1}')" "$(sudo stat -c %F ${JSON.stringify(installed)})"` : ''} >> ${JSON.stringify(manifest)}; else printf 'file\\t%s\\tfalse\\t-\\t-\\t-\\t-\\t-\\t-\\n' ${JSON.stringify(name)} >> ${JSON.stringify(manifest)}; fi`);
      if (backedUp.code !== 0) throw new Error(`script backup failed (${name}): ${redact(backedUp.stderr || backedUp.stdout)}`.trim());
      if (parent !== '.') {
        const remoteParent = `${remoteDir}/${parent}`;
        const remoteParentResult = await exec(client, `mkdir -p ${JSON.stringify(remoteParent)}`);
        if (remoteParentResult.code !== 0) throw new Error(`script upload directory setup failed (${join(parent, name.slice(parent.length + 1))}): ${remoteParentResult.stderr || remoteParentResult.stdout}`.trim());
      }
      await upload(client, local, remote, mode);
      const remotePreflightChecks = `test -f ${JSON.stringify(remote)} && test ! -L ${JSON.stringify(remote)} && test "$(realpath -- ${JSON.stringify(remote)})" = ${JSON.stringify(remote)}${executable
        ? ` && test -x ${JSON.stringify(remote)}`
        : ''}`;
      const remoteLineEndingCheck = binary
        ? 'true'
        : `! grep -q "$(printf '\\r')" ${JSON.stringify(remote)}`;
      const remoteBinaryCheck = binary
        ? `case "$(uname -m):$(file -b ${JSON.stringify(remote)})" in x86_64:*ELF*x86-64*|aarch64:*ELF*ARM\\ aarch64*|armv7l:*ELF*ARM*) ;; *) exit 1 ;; esac${verifyBinaries ? ` && test "$(sha256sum ${JSON.stringify(remote)} | awk '{print $1}')" = ${JSON.stringify(localHash)}` : ''}`
        : 'true';
      const remotePreflightResult = await exec(client, `${remotePreflightChecks} && ${remoteLineEndingCheck} && ${remoteBinaryCheck}`);
      if (remotePreflightResult.code !== 0) {
        throw new Error(`remote script preflight failed (${name}): ${redact(remotePreflightResult.stderr || remotePreflightResult.stdout || 'mode or line-ending check failed')}`.trim());
      }
      staged.push({ name, remote, installed, parent, mode, executable, binary, managed: previouslyManaged.has(name) });
    }
    for (const { name, remote, installed, parent, mode, executable, binary, managed } of staged) {
      const temporary = `${installed}.vyops-${runId}`;
      const ownership = managed
        ? ` && sudo chown --reference=${JSON.stringify(`${backupDir}/${name}`)} ${JSON.stringify(temporary)}`
        : ` && sudo chown root:root ${JSON.stringify(temporary)}`;
      const remoteChecks = ` && sudo test -f ${JSON.stringify(installed)} && sudo test ! -L ${JSON.stringify(installed)} && test "$(sudo realpath -- ${JSON.stringify(installed)})" = ${JSON.stringify(installed)}${executable
        ? ` && sudo test -x ${JSON.stringify(installed)}`
        : ''}`;
      const lineEndingCheck = binary
        ? ''
        : ` && ! sudo grep -q "$(printf '\\r')" ${JSON.stringify(installed)}`;
      const destinationCheck = `if sudo test -L ${JSON.stringify(installed)}; then exit 1; elif sudo test -e ${JSON.stringify(installed)}; then sudo test -f ${JSON.stringify(installed)} && test "$(sudo realpath -- ${JSON.stringify(installed)})" = ${JSON.stringify(installed)}; fi`;
      const installedResult = await exec(client, `sudo mkdir -p ${JSON.stringify(`${installDir}/${parent}`)} && sudo rm -f -- ${JSON.stringify(temporary)} && sudo install -m ${mode.toString(8)} ${JSON.stringify(remote)} ${JSON.stringify(temporary)}${ownership} && sudo chmod ${mode.toString(8)} ${JSON.stringify(temporary)} && sudo test -f ${JSON.stringify(temporary)} && sudo test ! -L ${JSON.stringify(temporary)} && test "$(sudo realpath -- ${JSON.stringify(temporary)})" = ${JSON.stringify(temporary)}${executable ? ` && sudo test -x ${JSON.stringify(temporary)}` : ''}${lineEndingCheck.replaceAll(JSON.stringify(installed), JSON.stringify(temporary))} && ${destinationCheck} && sudo mv -f -- ${JSON.stringify(temporary)} ${JSON.stringify(installed)}${remoteChecks} || { sudo rm -f -- ${JSON.stringify(temporary)}; exit 1; }`);
      if (installedResult.code !== 0) throw new Error(`script install failed (${name}): ${redact(installedResult.stderr || installedResult.stdout)}`.trim());
      const manifestResult = await exec(client, `printf 'file\\t%s\\t-\\t-\\t-\\t-\\t%s\\t%s\\t%s\\n' ${JSON.stringify(name)} "$(sudo stat -c %a ${JSON.stringify(installed)})" "$(sudo sha256sum ${JSON.stringify(installed)} | awk '{print $1}')" "$(sudo stat -c %F ${JSON.stringify(installed)})" >> ${JSON.stringify(manifest)}`);
      if (manifestResult.code !== 0) throw new Error(`manifest update failed (${name}): ${redact(manifestResult.stderr || manifestResult.stdout)}`.trim());
      debugLog(`installed script: ${name}`);
    }
  } catch (error) {
    await rollbackScripts(exec, log, { client, manifest, installDir, backupDir, remoteDir });
    throw error;
  }
  return async (committed, activeClient) => {
    await finalizeScripts(exec, log, { client: activeClient, committed, manifest, installDir, backupDir, remoteDir });
  };
}
