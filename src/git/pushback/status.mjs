export function hasStagedAndUnstagedChanges(status) {
  return status
    .split("\0")
    .some((entry) => entry.length > 2 && entry[0] !== " " && entry[0] !== "?" && entry[1] !== " ");
}

export function hasUntrackedFiles(status) {
  return status.split("\0").some((entry) => entry.startsWith("??"));
}
