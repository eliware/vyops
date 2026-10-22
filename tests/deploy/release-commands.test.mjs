import { jest } from "@jest/globals";
import { promises, resetMemoryFilesystem } from "../../test-fixtures/helpers/memory-filesystem.mjs";
import "../../test-fixtures/helpers/memory-filesystem-setup.mjs";
import { setupDeployHarness } from "../../test-fixtures/deploy-harness.mjs";

beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs/promises", () => promises);
const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises");
const { join } = await import("node:path");
const { fsMocks, mocks, deploy } = await setupDeployHarness(jest);
const { runReleaseCommands } = await import("../../src/deploy/release-commands.mjs");

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

test("runs deployment phases in order", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-deploy-"));
  const scripts = join(root, "scripts");
  await mkdir(scripts, { recursive: true });
  await writeFile(join(scripts, "hook.sh"), "#!/bin/sh\n");
  try {
    fsMocks.readdir.mockResolvedValue([{ name: "hook.sh", isFile: () => true }]);
    await expect(
      deploy({ target: "testuser@test-router.example.test", config: join(root, "config.boot") }),
    ).resolves.toBe(0);
    const phases = mocks.interactive.mock.calls[0][1]
      .filter((item) => item?.phase)
      .map((item) => item.phase);
    expect(phases).toEqual([
      "load candidate",
      "compare",
      "compare",
      "commit-confirm",
      "confirm",
      "save",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
