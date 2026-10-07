import {
  cleanInteractiveText as clean,
  interactiveFailureDetail as failureDetail,
} from "./interactive-support.mjs";
import { attachInteractiveData } from "./interactive-data.mjs";

export function attachInteractiveListeners(options) {
  const { client, stream, commands, log, state, timer, resolve, reject } = options;
  attachInteractiveData(options);
  stream.on("error", (error) => {
    log(`interactive stream error: ${error.message}`);
    clearTimeout(timer);
    state.settled = true;
    stream.close?.();
    client.end?.();
    reject(error);
  });
  stream.stderr.on("data", (data) => {
    const text = data.toString();
    state.output += text;
    state.response += text;
    log(`recv stderr (${text.length} bytes): ${JSON.stringify(text)}`);
    if (
      state.waiting &&
      typeof state.currentItem !== "string" &&
      state.currentItem.reject?.test(clean(state.response))
    ) {
      state.settled = true;
      clearTimeout(timer);
      stream.close();
      client.end?.();
      const detail = failureDetail(clean(state.response));
      reject(
        new Error(
          `interactive command failed: ${state.currentItem.command}${detail ? ` (${detail})` : ""}`,
        ),
      );
    }
  });
  stream.on("close", () => {
    log(
      `VyOS interactive shell closed; settled=${state.settled}; index=${state.index}/${commands.length}`,
    );
    clearTimeout(timer);
    if (!state.settled && !state.timedOut) {
      const finalCommand = commands.at(-1);
      const expectedClose =
        typeof finalCommand === "string"
          ? finalCommand === "exit"
          : finalCommand?.command === "exit";
      if (commands.length === 0 || (state.index >= commands.length && expectedClose))
        resolve(state.output);
      else reject(new Error("interactive SSH closed before command sequence completed"));
    }
  });
}
