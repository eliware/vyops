import { cleanInteractiveText as clean } from "./interactive-text.mjs";
import { isRouterPrompt as prompt, isCommitPrompt } from "./interactive-recognition.mjs";
import { answerInteractivePrompt } from "./interactive-prompts.mjs";
import {
  completeInteractiveCommand,
  rejectInteractiveCommand,
} from "./interactive-command-state.mjs";

export function attachInteractiveData(options) {
  const { stream, commands, log, state, timer, sendNext, resolve, reject, onCommandComplete } =
    options;
  stream.on("data", (data) => {
    if (state.settled || state.timedOut) return;
    const text = data.toString();
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
    const commandComplete = state.waiting && prompt(cleaned) && !isCommitPrompt(cleaned);
    log(`command completion check: complete=${commandComplete}`);
    if (commandComplete) {
      log(`command ${state.index} completed; response=${cleaned.length} bytes`);
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
  });
}
