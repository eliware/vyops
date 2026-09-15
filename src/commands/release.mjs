import { validateBundle } from '../bundle.mjs';

export async function prepareRelease(args, text, log) {
  const bundle = await validateBundle(args.config, text);
  args.target = bundle.target;
  args.hasHaproxyHooks = bundle.scripts.some(script => /haproxy/i.test(script));
  args.hasBinaryScripts = bundle.scripts.some(script => /\.exe$/i.test(script));
  log.info(`[deployment ${args.operationId}] Release target: ${args.target}; config: ${args.config}; scripts: ${bundle.scripts.length}; hooks: ${args.noHooks ? 'disabled' : 'enabled'}; verification: ${args.verify ? 'enabled' : 'disabled'}; pushback: ${args.noPushback ? 'disabled' : 'enabled'}`);
  if (args.noHooks) log.warn(`[deployment ${args.operationId}] WARNING: --no-hooks disables all synchronized post-commit hooks for this release.`);
  if (args.noPushback) log.warn(`[deployment ${args.operationId}] WARNING: --no-pushback may leave VyOS and Git out of sync because VyOS can rewrite configuration ordering in ways that are not logically obvious. Avoid --no-pushback unless you understand and accept this risk.`);
  return args;
}
