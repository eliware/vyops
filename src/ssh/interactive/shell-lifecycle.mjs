export function createInteractiveShellErrorHandler({ state, timer, reject }) {
  return (error) => {
    if (state.settled) return;
    state.settled = true;
    clearTimeout(timer);
    reject(error);
  };
}
