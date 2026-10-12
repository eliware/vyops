import {
  cleanInteractiveText as clean,
  isRouterPrompt as prompt,
  isPagerPrompt,
  isCommitPrompt,
} from "./interactive-support.mjs";
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
    const { found: pager, returnPager: pagerReturn } = isPagerPrompt(cleaned);
    log(
      `state after data: index=${state.index}, waiting=${state.waiting}, answering=${state.answering}, prompt=${prompt(cleaned)}, pager=${pager}, bytes=${text.length}`,
    );
    if (pager) {
      const key = pagerReturn ? "\n" : " ";
      log(`pager prompt detected; sending ${pagerReturn ? "return" : "space"}`);
      stream.write(key);
      log(`write complete: ${pagerReturn ? "return" : "space"}`);
      return;
    }
    if (isCommitPrompt(cleaned) && !state.answering) {
      state.answering = true;
      log("commit-confirm prompt detected; sending: yes");
      state.response = "";
      stream.write("yes\n");
      log("write complete: yes");
      return;
    }
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
