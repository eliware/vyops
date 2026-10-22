import { join } from "node:path";
import { scanTree } from "./tree/scan.mjs";

export async function filesIn(directory, fsApi) {
  return scanTree(
    directory,
    (current) => fsApi.readdir(current, { withFileTypes: true }),
    join,
    "",
    "empty",
    "empty",
  );
}
