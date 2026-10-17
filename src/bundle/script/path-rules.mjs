export function isSafeScriptPath(name) {
  return (
    typeof name === "string" &&
    /^[A-Za-z0-9._/@-]+$/.test(name) &&
    !name.startsWith("/") &&
    !name.split("/").some((part) => !part || part === "." || part === "..")
  );
}

export function validateScriptPath(name) {
  if (!isSafeScriptPath(name)) throw new Error(`preflight failed: scripts/${name} path is invalid`);
}
