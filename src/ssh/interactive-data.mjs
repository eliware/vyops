import { handleInteractiveData } from "./interactive-data-handler.mjs";

export function attachInteractiveData(options) {
  const { stream } = options;
  stream.on("data", (data) => {
    handleInteractiveData(data.toString(), options);
  });
}
