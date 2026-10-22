import { shellQuote } from "../../shell-quote.mjs";

export async function cleanupRemoteScriptSnapshot(
  exec,
  client,
  snapshotDirectory,
  operationError,
  { includeExitCode = false } = {},
) {
  let cleanupError;
  try {
    const result = await exec(client, `rm -rf -- ${shellQuote(snapshotDirectory)}`);
    if (result.code !== 0) {
      const output = result.stderr || result.stdout;
      cleanupError = new Error(
        `remote snapshot cleanup failed: ${output || (includeExitCode ? `exit code ${result.code}` : "")}`,
      );
    }
  } catch (error) {
    cleanupError = error;
  }
  if (cleanupError)
    throw new Error(cleanupError.message, { cause: operationError || cleanupError });
  if (operationError) throw operationError;
}
