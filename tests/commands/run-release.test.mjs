import { jest } from "@jest/globals";

const runPreflight = jest.fn();
const prepareRelease = jest.fn();
const deploy = jest.fn();
const pushBack = jest.fn();
const repositorySnapshot = jest.fn();
const shouldSkip = jest.fn();
const log = { debug: jest.fn(), info: jest.fn() };
await jest.unstable_mockModule("../../src/commands/preflight.mjs", () => ({ runPreflight }));
await jest.unstable_mockModule("../../src/commands/release.mjs", () => ({ prepareRelease }));
await jest.unstable_mockModule("../../src/deploy.mjs", () => ({ deploy }));
await jest.unstable_mockModule("../../src/git.mjs", () => ({
  pushBack,
  repositorySnapshot,
  shouldSkip,
}));
const { runRelease } = await import("../../src/commands/run-release.mjs");

beforeEach(() => {
  jest.clearAllMocks();
  runPreflight.mockResolvedValue({ target: "vyos@router" });
  repositorySnapshot.mockResolvedValue({ repo: "/repo", state: "snapshot" });
  shouldSkip.mockResolvedValue(false);
  pushBack.mockResolvedValue(false);
});

test("runs preflight, prepares, deploys, and pushes back", async () => {
  const args = { command: "release", config: "config.boot", operationId: "op" };
  pushBack.mockResolvedValue(true);
  await runRelease(args, log);
  expect(runPreflight).toHaveBeenCalledWith(args, log);
  expect(prepareRelease).toHaveBeenCalledWith(args, { target: "vyos@router" }, log);
  expect(repositorySnapshot).toHaveBeenCalledWith("config.boot");
  expect(deploy).toHaveBeenCalledWith(args);
  expect(pushBack).toHaveBeenCalledWith("config.boot", {
    force: undefined,
    expectedState: { repo: "/repo", state: "snapshot" },
  });
  expect(log.info).toHaveBeenCalledWith(expect.stringContaining("Pushback committed and pushed"));
  expect(log.info).toHaveBeenCalledWith("[deployment op] Deployment successful");
});

test("skips unchanged releases unless force is set", async () => {
  const args = { command: "release", config: "config.boot", operationId: "op" };
  shouldSkip.mockResolvedValue(true);
  await runRelease(args, log);
  expect(deploy).not.toHaveBeenCalled();
  expect(log.info).toHaveBeenCalledWith(expect.stringContaining("skipping deployment"));
  await runRelease({ ...args, force: true }, log);
  expect(deploy).toHaveBeenCalledTimes(1);
});

test("skips pushback checks when pushback is disabled", async () => {
  const args = {
    command: "release",
    config: "config.boot",
    operationId: "op",
    noPushback: true,
  };
  await runRelease(args, log);
  expect(shouldSkip).not.toHaveBeenCalled();
  expect(repositorySnapshot).not.toHaveBeenCalled();
  expect(pushBack).not.toHaveBeenCalled();
  expect(deploy).toHaveBeenCalledWith(args);
});
