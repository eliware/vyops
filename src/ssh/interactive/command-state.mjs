import { interactiveFailureDetail } from "./failure-detail.mjs";
import { isRouterPrompt, isCommitPrompt } from "./recognition.mjs";

export function shouldCompleteInteractiveCommand(state, cleaned) {
  return state.waiting && isRouterPrompt(cleaned) && !isCommitPrompt(cleaned);
}

export function rejectInteractiveCommand({ state, stream, timer, reject, cleaned }) {
  if (
    !state.waiting ||
    typeof state.currentItem === "string" ||
    !state.currentItem.reject?.test(cleaned)
  )
    return false;
  state.settled = true;
  state.waiting = false;
  clearTimeout(timer);
  stream.close();
  const detail = interactiveFailureDetail(cleaned);
  reject(
    new Error(
      `interactive command failed: ${state.currentItem.command}${detail ? ` (${detail})` : ""}`,
    ),
  );
  return true;
}

export function completeInteractiveCommand({
  state,
  commands,
  stream,
  timer,
  sendNext,
  resolve,
  onCommandComplete,
}) {
  if (!state.waiting) return false;
  onCommandComplete(
    typeof state.currentItem === "string" ? state.currentItem : state.currentItem.command,
  );
  state.answering = false;
  state.waiting = false;
  if (state.index >= commands.length) {
    state.settled = true;
    clearTimeout(timer);
    stream.end();
    resolve(state.output);
  } else sendNext();
  return true;
}
