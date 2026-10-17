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

export function validateCommandOptionPolicy(command, options, usage) {
  const allowed =
    command === "release"
      ? releaseOptions
      : command === "backup"
        ? ["--debug", "--password-stdin"]
        : ["--debug"];
  const invalidOptions = [...options].some((option) => !allowed.includes(option));
  const invalidRelease =
    command === "release" &&
    (!options.has("--yes") || (options.has("--no-hooks") && !options.has("--force")));
  if (invalidOptions || invalidRelease) throw new Error(usage);
}
