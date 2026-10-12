function context(client) {
  return `deployment=${client?.__vyopsDeploymentId || "unknown"} target=${client?.__vyopsTarget || "unknown"} phase=${client?.__vyopsPhase || "unknown"}`;
}

export function startInteractiveTimeout({
  operation,
  commands,
  state,
  stream,
  client,
  log,
  reject,
}) {
  const configured = Number(process.env.VYOPS_INTERACTIVE_TIMEOUT);
  const delay = Number.isFinite(configured) && configured > 0 ? configured : 60000;
  return setTimeout(() => {
    log(
      `timeout; next command: ${state.index + 1}/${commands.length}; waiting=${state.waiting}; answering=${state.answering}`,
    );
    log(`partial response: ${state.response.length} bytes`);
    state.timedOut = true;
    state.settled = true;
    stream.close();
    const item = state.currentItem;
    const command = item ? (typeof item === "string" ? item : item.command) : "none";
    const error = new Error(
      `Interactive SSH timed out [${operation}] (${context(client)}): ${command}`,
    );
    error.code = "VYOPS_TIMEOUT";
    reject(error);
  }, delay);
}
