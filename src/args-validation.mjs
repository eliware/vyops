const releaseOptions = [
  "--yes",
  "--force",
  "--debug",
  "--verify",
  "--verify-binaries",
  "--no-pushback",
  "--no-hooks",
  "--password-stdin",
];

export function validateCommandOptions(command, options, valueCount, usage) {
  const allowed =
    command === "release"
      ? releaseOptions
      : command === "backup"
        ? ["--debug", "--password-stdin"]
        : ["--debug"];
  const expectedValues = command === "backup" ? 2 : 1;
  const invalidOptions = [...options].some((option) => !allowed.includes(option));
  const invalidRelease =
    command === "release" &&
    (!options.has("--yes") || (options.has("--no-hooks") && !options.has("--force")));
  if (invalidOptions || valueCount !== expectedValues || invalidRelease) throw new Error(usage);
}
