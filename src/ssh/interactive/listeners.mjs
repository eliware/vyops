import { attachInteractiveData } from "./data.mjs";
import { attachInteractiveLifecycle } from "./lifecycle.mjs";

export function attachInteractiveListeners(options) {
  attachInteractiveData(options);
  attachInteractiveLifecycle(options);
}
