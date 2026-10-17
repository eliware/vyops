export async function prepareRelease(args, bundle, log) {
  args.target = bundle.target;
  args.hasHaproxyHooks = bundle.scripts.some((script) => /haproxy/i.test(script));
  args.hasBinaryScripts = bundle.scripts.some((script) => /\.exe$/i.test(script));
  log.info(
    [
      `[deployment ${args.operationId}] Release target: ${args.target}, config: ${args.config},`,
      `scripts: ${bundle.scripts.length}, post-commit scripts: ${args.noHooks ? "disabled" : "enabled"},`,
      `verification: ${args.verify ? "enabled" : "disabled"}, pushback: ${args.noPushback ? "disabled" : "enabled"}`,
    ].join(" "),
  );
  if (args.noHooks)
    log.warn(
      `[deployment ${args.operationId}] WARNING: --no-hooks disables all synced post-commit scripts for this release.`,
    );
  if (args.noPushback)
    log.warn(
      `[deployment ${args.operationId}] WARNING: --no-pushback can make VyOS state and Git inconsistent. VyOS can change config order. Use this option only when you accept this risk.`,
    );
  return args;
}
