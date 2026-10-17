import { shellQuote } from "../../shell-quote.mjs";

export async function snapshotRemoteScript(exec, client, remote, snapshot) {
  const script = `${snapshot}/script`;
  let snapshotError;
  try {
    const result = await exec(
      client,
      [
        `mkdir -m 700 -- ${shellQuote(snapshot)} || exit 1`,
        `if test ! -L ${shellQuote(remote)} && exec 3<${shellQuote(remote)} && test -f /proc/self/fd/3 && test "$(realpath -- /proc/self/fd/3)" = ${shellQuote(remote)} && cat <&3 > ${shellQuote(script)}`,
        "then exit 0",
        "fi",
        "exit 1",
      ].join("\n"),
    );
    if (result.code !== 0)
      snapshotError = new Error(`remote script changed or is not a regular file: ${remote}`);
  } catch (error) {
    snapshotError = error;
  }
  if (!snapshotError) return;

  try {
    const cleanup = await exec(client, `rm -rf -- ${shellQuote(snapshot)}`);
    if (cleanup.code !== 0)
      throw new Error(cleanup.stderr || cleanup.stdout || `exit code ${cleanup.code}`);
  } catch (error) {
    throw new Error(`remote snapshot cleanup failed: ${error.message}`, { cause: snapshotError });
  }
  throw snapshotError;
}
