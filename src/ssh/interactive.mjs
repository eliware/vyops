import { randomUUID } from "node:crypto";
import { attachInteractiveListeners } from "./interactive-listeners.mjs";

const timeout = (name, fallback) =>
  Number.isFinite(Number(process.env[name])) && Number(process.env[name]) > 0
    ? Number(process.env[name])
    : fallback;

function context(client) {
  return `deployment=${client?.__vyopsDeploymentId || "unknown"} target=${client?.__vyopsTarget || "unknown"} phase=${client?.__vyopsPhase || "unknown"}`;
}

function timeoutError(message, _client) {
  const error = new Error(message);
  error.code = "VYOPS_TIMEOUT";
  return error;
}

export function interactive(client, commands, log = () => {}, onCommandComplete = () => {}) {
  const operation = randomUUID();
  return new Promise((resolve, reject) => {
    client.shell({ term: "xterm", cols: 160, rows: 48 }, (error, stream) => {
      if (error) return reject(error);
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
      const timer = setTimeout(
        () => {
          log(
            `timeout; next command: ${state.index + 1}/${commands.length}; waiting=${state.waiting}; answering=${state.answering}`,
          );
          log(`partial response:\n${state.response}`);
          state.timedOut = true;
          state.settled = true;
          stream.close();
          client.end?.();
          const command = state.currentItem
            ? typeof state.currentItem === "string"
              ? state.currentItem
              : state.currentItem.command
            : "none";
          reject(
            timeoutError(
              `Interactive SSH timed out [${operation}] (${context(client)}): ${command}`,
              client,
            ),
          );
        },
        timeout("VYOPS_INTERACTIVE_TIMEOUT", 60000),
      );
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
        log(`send [${state.index}/${commands.length}]: ${command}`);
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
    });
  });
}
