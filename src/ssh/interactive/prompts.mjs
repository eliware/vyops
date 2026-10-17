import { isPagerPrompt, isCommitPrompt } from "./recognition.mjs";

export function answerInteractivePrompt({ cleaned, state, stream, log }) {
  const { found, returnPager } = isPagerPrompt(cleaned);
  if (found) {
    const key = returnPager ? "\n" : " ";
    state.response = "";
    log(`pager prompt detected. Sending ${returnPager ? "return" : "space"}.`);
    stream.write(key);
    log(`write complete: ${returnPager ? "return" : "space"}`);
    return true;
  }
  if (isCommitPrompt(cleaned) && !state.answering) {
    state.answering = true;
    log("commit-confirm prompt detected. Sending yes.");
    state.response = "";
    stream.write("yes\n");
    log("write complete: yes");
    return true;
  }
  return false;
}
