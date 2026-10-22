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
    const directory = shellQuote(snapshotDirectory);
    const result = await exec(
      client,
      `if test -L ${directory}; then exit 1; elif test -d ${directory}; then find -P ${directory} -maxdepth 1 -type f -name script -delete && rmdir -- ${directory}; elif test -e ${directory}; then exit 1; else exit 0; fi`,
    );
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
