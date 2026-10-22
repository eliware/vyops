import { readPasswordText } from "./password/reader.mjs";
import { validatePassword } from "./password/validation.mjs";

export async function readPasswordStdin(input) {
  return validatePassword(await readPasswordText(input));
}
