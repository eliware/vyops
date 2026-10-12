import { parseArgs, usage } from "./args.mjs";
import packageJson from "../package.json" with { type: "json" };
import { cleanupActiveDeployments, deploy } from "./deploy.mjs";
import { readAndValidateConfig } from "./validate.mjs";
import { runBackup } from "./commands/backup.mjs";
import { runPreflight } from "./commands/preflight.mjs";
import { prepareRelease } from "./commands/release.mjs";
import { pushBack, repositorySnapshot, shouldSkip } from "./git.mjs";
import { closeAll } from "./ssh.mjs";
import { log, registerHandlers, registerSignals } from "@eliware/common";
import { randomUUID } from "node:crypto";
import { readPasswordStdin } from "./cli/password.mjs";
import { registerCliLifecycle } from "./cli/lifecycle.mjs";

export async function runCli() {
  const lifecycle = registerCliLifecycle({
    log,
    registerHandlers,
    registerSignals,
    closeAll,
    cleanup: cleanupActiveDeployments,
  });
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.debug) log.level = "debug";
    args.operationId = randomUUID();
    log.debug(
      `[vyops] [${args.command || "cli"} ${args.operationId}] arguments parsed: target=${args.command === "backup" ? args.target : "-"} config=${args.config || "-"}`,
    );
    if (args.help) {
      log.info(usage);
      return;
    }
    if (args.version) {
      process.stdout.write(`${packageJson.version}\n`);
      return;
    }
    if (args.passwordStdin) {
      args.password = await readPasswordStdin(process.stdin);
    }
    if (args.command === "backup") {
      await runBackup(args, log);
      return;
    }
    if (args.command === "preflight") {
      await runPreflight(args, log);
      return;
    }
    if (args.command === "release") {
      const bundle = await runPreflight(args, log);
      await prepareRelease(args, bundle, log);
    }
    log.debug(`[vyops] [deployment ${args.operationId}] validating config: ${args.config}`);
    if (args.command !== "release") await readAndValidateConfig(args.config);
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
  } catch (error) {
    log.error(error.message);
    process.exitCode = 1;
  } finally {
    await lifecycle.finish();
  }
}
