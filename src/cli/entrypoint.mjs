import { registerCliLifecycle } from "./lifecycle.mjs";

export async function runCliEntrypoint({
  log,
  registerHandlers,
  registerSignals,
  closeAll,
  cleanup,
  run,
}) {
  const lifecycle = registerCliLifecycle({
    log,
    registerHandlers,
    registerSignals,
    closeAll,
    cleanup,
  });
  try {
    await run();
  } catch (error) {
    log.error(error.message);
    process.exitCode = 1;
  } finally {
    try {
      await lifecycle.finish();
    } catch (error) {
      log.error(error.message);
      process.exitCode = 1;
    }
  }
}
