import { parse, resolve } from "node:path";

export function backupDestination(config) {
  const destination = resolve(config);
  if (destination === parse(destination).root)
    throw new Error("backup destination must not be a filesystem root");
  return destination;
}
