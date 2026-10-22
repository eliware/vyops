import { fs } from "@eliware/common";

export async function readConfigFile(path) {
  return fs.promises.readFile(path, "utf8");
}
