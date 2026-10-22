import { validateScriptContent } from "./content-validation.mjs";

export async function validateScriptFile(fsApi, { file, name }) {
  const data = await fsApi.readFile(file);
  const mode = (await fsApi.stat(file)).mode & 0o777;
  validateScriptContent(name, data, mode);
}
