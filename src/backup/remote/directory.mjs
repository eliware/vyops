import { shellQuote } from "../shell-quote.mjs";

export async function inspectRemoteScriptDirectory(exec, client, name) {
  const remote = `/config/scripts/${name}`;
  const quoted = shellQuote(remote);
  const result = await exec(
    client,
    `test -d ${quoted} && test ! -L ${quoted} && test "$(realpath -- ${quoted})" = ${quoted} && stat -c %a -- ${quoted}`,
  );
  const mode = result.stdout.trim();
  if (result.code !== 0 || !/^\d{3,4}$/.test(mode))
    throw new Error(`remote script directory changed or is not a directory: ${remote}`);
  return { name, mode, type: "directory" };
}
