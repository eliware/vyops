import { parseArgs, usage } from "./args.mjs";
import packageJson from "../package.json" with { type: "json" };
import { cleanupActiveDeployments } from "./deploy.mjs";
import { runBackup } from "./commands/backup.mjs";
import { runPreflight } from "./commands/preflight.mjs";
import { runRelease } from "./commands/run-release.mjs";
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
      await runRelease(args, log);
    }
  } catch (error) {
    log.error(error.message);
    process.exitCode = 1;
  } finally {
    await lifecycle.finish();
  }
}
