import {
  cleanInteractiveText as clean,
  interactiveFailureDetail as failureDetail,
  isRouterPrompt as prompt,
  isPagerPrompt,
  isCommitPrompt,
} from "./interactive-support.mjs";

export function attachInteractiveData(options) {
  const { stream, commands, log, state, timer, sendNext, resolve, reject, onCommandComplete } =
    options;
  stream.on("data", (data) => {
    if (state.settled || state.timedOut) return;
    const text = data.toString();
    state.output += text;
    state.response += text;
    log(`recv (${text.length} bytes): ${JSON.stringify(text)}`);
    const cleaned = clean(state.response);
    if (
      state.waiting &&
      typeof state.currentItem !== "string" &&
      state.currentItem.reject?.test(cleaned)
    ) {
      state.settled = true;
      clearTimeout(timer);
      stream.close();
      const detail = failureDetail(cleaned);
      reject(
        new Error(
          `interactive command failed: ${state.currentItem.command}${detail ? ` (${detail})` : ""}`,
        ),
      );
      return;
    }
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
      onCommandComplete(
        typeof state.currentItem === "string" ? state.currentItem : state.currentItem.command,
      );
      state.answering = false;
      state.waiting = false;
      log(`response [${state.index}]:\n${cleaned}`);
      if (state.index >= commands.length) {
        state.settled = true;
        clearTimeout(timer);
        stream.end();
        resolve(state.output);
      } else sendNext();
    }
  });
}
