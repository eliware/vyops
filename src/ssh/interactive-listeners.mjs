import { cleanInteractiveText as clean } from "./interactive-support.mjs";
import { attachInteractiveData } from "./interactive-data.mjs";
import { rejectInteractiveCommand } from "./interactive-command-state.mjs";

export function attachInteractiveListeners(options) {
  const { stream, commands, log, state, timer, resolve, reject } = options;
  attachInteractiveData(options);
  stream.on("error", (error) => {
    log(`interactive stream error: ${error.message}`);
    clearTimeout(timer);
    state.settled = true;
    stream.close?.();
    reject(error);
  });
  stream.stderr.on("data", (data) => {
    const text = data.toString();
    state.output += text;
    state.response += text;
    log(`received ${text.length} interactive error bytes`);
    rejectInteractiveCommand({ state, stream, timer, reject, cleaned: clean(state.response) });
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
