import { isPagerPrompt, isCommitPrompt } from "./interactive-recognition.mjs";

export function answerInteractivePrompt({ cleaned, state, stream, log }) {
  const { found, returnPager } = isPagerPrompt(cleaned);
  if (found) {
    const key = returnPager ? "\n" : " ";
    log(`pager prompt detected; sending ${returnPager ? "return" : "space"}`);
    stream.write(key);
    log(`write complete: ${returnPager ? "return" : "space"}`);
    return true;
  }
  if (isCommitPrompt(cleaned) && !state.answering) {
    state.answering = true;
    log("commit-confirm prompt detected; sending: yes");
    state.response = "";
    stream.write("yes\n");
    log("write complete: yes");
    return true;
  }
  return false;
}
