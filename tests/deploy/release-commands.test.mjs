import { jest } from "@jest/globals";
import { runReleaseCommands } from "../../src/deploy/release-commands.mjs";

test("runs the candidate commit and save sequence", async () => {
  const interactive = async (_client, commands, _log, complete) => {
    commands.forEach((item) => complete(typeof item === "string" ? item : item.command));
    return "vyos@router# compare\n+ set system host-name router\nvyos@router# printf '%s\\n' '--- end compare ---'";
  };
  const confirmed = jest.fn();
  const result = await runReleaseCommands(interactive, {}, "/tmp/config", () => {}, confirmed);
  expect(confirmed).toHaveBeenCalledTimes(1);
  expect(result.compare).toContain("host-name router");
});

test("rejects a sequence that does not confirm the commit", async () => {
  const interactive = async () => "output";
  await expect(
    runReleaseCommands(
      interactive,
      {},
      "config",
      () => {},
      () => {},
    ),
  ).rejects.toThrow("without confirming the commit");
});
