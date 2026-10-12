export function buildArgsResult(command, options, values) {
  return {
    command,
    ...(command === "backup" ? { target: values[0], config: values[1] } : { config: values[0] }),
    ...(options.has("--yes") ? { yes: true } : {}),
    ...(options.has("--force") ? { force: true } : {}),
    ...(options.has("--debug") ? { debug: true } : {}),
    ...(options.has("--verify") ? { verify: true } : {}),
    ...(options.has("--verify-binaries") ? { verifyBinaries: true } : {}),
    ...(options.has("--no-pushback") ? { noPushback: true } : {}),
    ...(options.has("--no-hooks") ? { noHooks: true } : {}),
    ...(options.has("--password-stdin") ? { passwordStdin: true } : {}),
  };
}
