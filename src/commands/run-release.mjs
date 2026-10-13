import { deploy } from "../deploy.mjs";
import { runPreflight } from "./preflight.mjs";
import { prepareRelease } from "./release.mjs";
import { pushBack, repositorySnapshot, shouldSkip } from "../git.mjs";

export async function runRelease(args, log) {
  const bundle = await runPreflight(args, log);
  await prepareRelease(args, bundle, log);
  log.debug(`[vyops] [deployment ${args.operationId}] validating config: ${args.config}`);
  log.debug(`[vyops] [deployment ${args.operationId}] config validation complete`);
  if (!args.force && !args.noPushback && (await shouldSkip(args.config))) {
    log.info(
      `[deployment ${args.operationId}] Latest commit is Pushback and deployment files are unchanged; skipping deployment`,
    );
    return;
  }
  log.debug(`[vyops] [deployment ${args.operationId}] phase: release / connect`);
  const expectedRepository = !args.noPushback ? await repositorySnapshot(args.config) : null;
  await deploy(args);
  log.debug(`[vyops] [deployment ${args.operationId}] phase: pushback`);
  if (
    !args.noPushback &&
    (await pushBack(args.config, { force: args.force, expectedState: expectedRepository }))
  ) {
    log.info(`[deployment ${args.operationId}] Pushback committed and pushed`);
  }
  log.info(`[deployment ${args.operationId}] Deployment successful`);
}
