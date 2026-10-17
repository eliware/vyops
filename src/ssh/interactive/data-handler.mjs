import { cleanInteractiveText as clean } from "./text.mjs";
import { isRouterPrompt as prompt } from "./recognition.mjs";
import { answerInteractivePrompt } from "./prompts.mjs";
import {
  completeInteractiveCommand,
  rejectInteractiveCommand,
  shouldCompleteInteractiveCommand,
} from "./command-state.mjs";

export function handleInteractiveData(text, options) {
  const { commands, log, state, stream, timer, sendNext, resolve, reject, onCommandComplete } =
    options;
  if (state.settled || state.timedOut) return;
  state.output += text;
  state.response += text;
  log(`received ${text.length} interactive output bytes`);
  const cleaned = clean(state.response);
  if (rejectInteractiveCommand({ state, stream, timer, reject, cleaned })) return;
  const promptHandled = answerInteractivePrompt({ cleaned, state, stream, log });
  log(
    `state after data: index=${state.index}, waiting=${state.waiting}, answering=${state.answering}, prompt=${prompt(cleaned)}, promptHandled=${promptHandled}, bytes=${text.length}`,
  );
  if (promptHandled) return;
  const commandComplete = shouldCompleteInteractiveCommand(state, cleaned);
  log(`command end check: complete=${commandComplete}`);
  if (commandComplete) {
    log(`command ${state.index} completed. response=${cleaned.length} bytes`);
    completeInteractiveCommand({
      state,
      commands,
      stream,
      timer,
      sendNext,
      resolve,
      onCommandComplete,
    });
  }
}
