export function registerCliLifecycle({
  log,
  registerHandlers,
  registerSignals,
  closeAll,
  cleanup,
}) {
  const errors = registerHandlers({ log });
  const signals = registerSignals({
    log,
    shutdownHook: async () => {
      await closeAll();
      await cleanup();
    },
  });
  return {
    errors,
    signals,
    finish: async () => {
      await closeAll();
      signals.removeHandlers();
      errors.removeHandlers();
    },
  };
}
