import { isSafeScriptPath } from "../bundle.mjs";

export function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

export function remoteScriptPath(value) {
  const name = value.replace(/^\/config\/scripts\/?/, "");
  if (!isSafeScriptPath(name)) {
    throw new Error(`unsafe remote script path: ${value}`);
  }
  return name;
}

export async function validateRemoteScript(exec, client, remote) {
  const quoted = shellQuote(remote);
  const metadata = await exec(
    client,
    `test -f ${quoted} && test ! -L ${quoted} && test "$(realpath -- ${quoted})" = ${quoted}`,
  );
  if (metadata.code !== 0)
    throw new Error(`remote script changed or is not a regular file: ${remote}`);
}

export async function snapshotRemoteScript(exec, client, remote, snapshot) {
  const script = `${snapshot}/script`;
  const result = await exec(
    client,
    `mkdir -m 700 -- ${shellQuote(snapshot)} || exit 1; if exec 3<${shellQuote(remote)} && test -f /proc/self/fd/3 && test "$(realpath -- /proc/self/fd/3)" = ${shellQuote(remote)} && cat <&3 > ${shellQuote(script)}; then exit 0; fi; rm -rf -- ${shellQuote(snapshot)}; exit 1`,
  );
  if (result.code !== 0)
    throw new Error(`remote script changed or is not a regular file: ${remote}`);
}
