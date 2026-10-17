import { shellQuote } from "../shell-quote.mjs";

export async function validateRemoteScript(exec, client, remote) {
  const quoted = shellQuote(remote);
  const metadata = await exec(
    client,
    `test -f ${quoted} && test ! -L ${quoted} && test "$(realpath -- ${quoted})" = ${quoted}`,
  );
  if (metadata.code !== 0)
    throw new Error(`remote script changed or is not a regular file: ${remote}`);
}
