export function createInteractiveState() {
  return {
    output: "",
    response: "",
    index: 0,
    waiting: false,
    answering: false,
    settled: false,
    timedOut: false,
    currentItem: undefined,
  };
}
