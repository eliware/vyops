import { attachInteractiveData } from "./interactive-data.mjs";
import { attachInteractiveLifecycle } from "./interactive-lifecycle.mjs";

export function attachInteractiveListeners(options) {
  attachInteractiveData(options);
  attachInteractiveLifecycle(options);
}
