const { buildArgsResult } = await import("../../src/args/result.mjs");

test("builds command results from parsed options and values", () => {
  expect(
    buildArgsResult(
      "release",
      new Set([
        "--yes",
        "--force",
        "--debug",
        "--verify",
        "--verify-binaries",
        "--no-pushback",
        "--no-hooks",
        "--password-stdin",
      ]),
      ["config.boot"],
    ),
  ).toEqual({
    command: "release",
    config: "config.boot",
    yes: true,
    force: true,
    debug: true,
    verify: true,
    verifyBinaries: true,
    noPushback: true,
    noHooks: true,
    passwordStdin: true,
  });
  expect(buildArgsResult("backup", new Set(), ["vyos@router", "/tmp/backup"])).toEqual({
    command: "backup",
    target: "vyos@router",
    config: "/tmp/backup",
  });
});
