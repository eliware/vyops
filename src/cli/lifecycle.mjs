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
      try {
        await closeAll();
      } finally {
        await cleanup();
      }
    },
  });
  return {
    errors,
    signals,
    finish: async () => {
      try {
        await closeAll();
      } finally {
        signals.removeHandlers();
        errors.removeHandlers();
      }
    },
  };
}
