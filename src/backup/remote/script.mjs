import { shellQuote } from "../shell-quote.mjs";

export async function validateRemoteScript(exec, client, remote) {
  const quoted = shellQuote(remote);
  const metadata = await exec(
    client,
    [
      `test -f ${quoted} && test ! -L ${quoted} && test "$(realpath -- ${quoted})" = ${quoted}`,
      `printf '%s\\t' "$(stat -c %a -- ${quoted})"`,
      `sha256sum -- ${quoted} | awk '{printf "%s\\t", $1}'`,
      `stat -c %F -- ${quoted}`,
    ].join(" && "),
  );
  if (metadata.code !== 0)
    throw new Error(`remote script changed or is not a regular file: ${remote}`);
  const [mode, sha256, type] = metadata.stdout.trimEnd().split("\t");
  if (!/^\d{3,4}$/.test(mode) || !/^[a-f\d]{64}$/.test(sha256) || type !== "regular file")
    throw new Error(`remote script metadata is invalid: ${remote}`);
  return { mode, sha256, type };
}
