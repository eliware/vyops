import { randomUUID } from "node:crypto";
import { attachInteractiveListeners } from "./interactive-listeners.mjs";
import { startInteractiveTimeout } from "./interactive-timeout.mjs";

export function interactive(client, commands, log = () => {}, onCommandComplete = () => {}) {
  const operation = randomUUID();
  return new Promise((resolve, reject) => {
    client.shell({ term: "xterm", cols: 160, rows: 48 }).then((stream) => {
      log("VyOS interactive shell opened");
      const state = {
        output: "",
        response: "",
        index: 0,
        waiting: false,
        answering: false,
        settled: false,
        timedOut: false,
        currentItem: undefined,
      };
      log(`interactive sequence start (${commands.length} commands)`);
      const timer = startInteractiveTimeout({
        operation,
        commands,
        state,
        stream,
        client,
        log,
        reject,
      });
      const sendNext = () => {
        if (state.waiting || state.index >= commands.length) return;
        state.currentItem = commands[state.index++];
        const item = state.currentItem;
        if (item && typeof item === "object" && item.phase) {
          client.__vyopsPhase = item.phase;
          log(`phase: ${item.phase}`);
        }
        const command = typeof item === "string" ? item : item.command;
        state.response = "";
        state.waiting = true;
        log(`send command [${state.index}/${commands.length}] (${command.length} characters)`);
        log(
          `state before send: index=${state.index}, waiting=${state.waiting}, answering=${state.answering}`,
        );
        stream.write(`${command}\n`);
        log(`write complete [${state.index}/${commands.length}]`);
      };
      attachInteractiveListeners({
        client,
        stream,
        commands,
        log,
        state,
        timer,
        sendNext,
        resolve,
        reject,
        onCommandComplete,
      });
      sendNext();
    }, reject);
  });
}
