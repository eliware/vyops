export function verificationCommands(mocks) {
  return mocks.exec.mock.calls
    .map(([, command]) => command)
    .filter((command) => command.startsWith("vbash -ic"))
    .map((command) => JSON.parse(command.slice(10)));
}

export function setVerificationResults(mocks, resultForCommand) {
  mocks.exec.mockImplementation(async (_client, command) => {
    if (!command.startsWith("vbash -ic ")) return { code: 0, stdout: "", stderr: "" };
    return (
      resultForCommand(JSON.parse(command.slice("vbash -ic ".length))) ?? {
        code: 0,
        stdout: "route table available",
        stderr: "",
      }
    );
  });
}
