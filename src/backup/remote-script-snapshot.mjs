import { shellQuote } from "./shell-quote.mjs";

export async function snapshotRemoteScript(exec, client, remote, snapshot) {
  const script = `${snapshot}/script`;
  const result = await exec(
    client,
    `mkdir -m 700 -- ${shellQuote(snapshot)} || exit 1; if exec 3<${shellQuote(remote)} && test -f /proc/self/fd/3 && test "$(realpath -- /proc/self/fd/3)" = ${shellQuote(remote)} && cat <&3 > ${shellQuote(script)}; then exit 0; fi; rm -rf -- ${shellQuote(snapshot)}; exit 1`,
  );
  if (result.code !== 0)
    throw new Error(`remote script changed or is not a regular file: ${remote}`);
}
