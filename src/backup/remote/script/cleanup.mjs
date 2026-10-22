import { shellQuote } from "../../shell-quote.mjs";

export async function cleanupRemoteScriptSnapshot(exec, client, snapshotDirectory, operationError) {
  let cleanupError;
  try {
    const result = await exec(client, `rm -rf -- ${shellQuote(snapshotDirectory)}`);
    if (result.code !== 0)
      cleanupError = new Error(`remote snapshot cleanup failed: ${result.stderr || result.stdout}`);
  } catch (error) {
    cleanupError = error;
  }
  if (cleanupError)
    throw new Error(cleanupError.message, { cause: operationError || cleanupError });
  if (operationError) throw operationError;
}
