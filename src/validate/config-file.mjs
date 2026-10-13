import { fs } from "@eliware/common";
import { validateConfig } from "./config.mjs";

export async function readAndValidateConfig(path) {
  const text = await fs.promises.readFile(path, "utf8");
  return validateConfig(text);
}
