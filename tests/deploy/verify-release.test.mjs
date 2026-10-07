import { setupDeployHarness } from "../../test-fixtures/deploy-harness.mjs";
import { jest } from "@jest/globals";
import { verifyRelease } from "../../src/deploy/verify-release.mjs";

test("runs optional router checks and logs their results", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0, stdout: "ok", stderr: "" });
  const log = { info: jest.fn() };
  await verifyRelease({}, exec, log, (value) => value);
  expect(exec).toHaveBeenCalledTimes(5);
  expect(log.info).toHaveBeenCalled();
});

test("rejects failed required checks", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 1, stdout: "failure", stderr: "" });
  await expect(verifyRelease({}, exec, { info: jest.fn() }, (value) => value)).rejects.toThrow(
    "verification phase failed",
  );
});

const { logMock, mocks, deploy } = await setupDeployHarness(jest);

test("runs optional post-deployment verification commands", async () => {
  await expect(
    deploy({
      target: "testuser@test-router.example.test",
      config: "/tmp/config.boot",
      verify: true,
    }),
  ).resolves.toBe(0);
  const commands = mocks.exec.mock.calls.map(([, command]) => command);
  expect(
    commands
      .filter((command) => command.startsWith("vbash -ic"))
      .map((command) => JSON.parse(command.slice(10))),
  ).toEqual([
    "show vrrp",
    "show interfaces wireguard",
    "show bgp summary",
    "show ip route",
    "show haproxy",
  ]);
});

test("does not fail verification when optional router services are absent", async () => {
  const absent = new Map([
    ["show vrrp", "VRRP data is not available (process not running or no active groups)"],
    ["show interfaces wireguard", "Interface        IP Address\n---------        ----------\n"],
    ["show bgp summary", "% BGP instance not found"],
    ["show haproxy", "Haproxy is not configured"],
  ]);
  mocks.exec.mockImplementation(async (_client, command) => {
    if (!command.startsWith("vbash -ic ")) return { code: 0, stdout: "", stderr: "" };
    const check = JSON.parse(command.slice("vbash -ic ".length));
    return absent.has(check)
      ? { code: 1, stdout: absent.get(check), stderr: "" }
      : { code: 0, stdout: "route table available", stderr: "" };
  });
  await expect(
    deploy({
      target: "testuser@test-router.example.test",
      config: "/tmp/config.boot",
      verify: true,
    }),
  ).resolves.toBe(0);
  expect(logMock.info).toHaveBeenCalledWith(
    expect.stringContaining(
      "show bgp summary: optional feature is not configured or active; continuing",
    ),
  );
  expect(logMock.info).toHaveBeenCalledWith(
    expect.stringContaining(
      "show interfaces wireguard: no WireGuard interfaces are configured; continuing",
    ),
  );
});

test("fails when a verification command returns an error", async () => {
  mocks.exec.mockImplementation(async (_client, command) =>
    command.startsWith("vbash -ic")
      ? { code: 1, stdout: "", stderr: "verification failed" }
      : { code: 0, stdout: "", stderr: "" },
  );
  await expect(
    deploy({
      target: "testuser@test-router.example.test",
      config: "/tmp/config.boot",
      verify: true,
    }),
  ).rejects.toThrow("verification phase failed (show vrrp): verification failed");
});

test("reports verification errors returned on stdout", async () => {
  mocks.exec.mockImplementation(async (_client, command) =>
    command.startsWith("vbash -ic")
      ? { code: 1, stdout: "verification stdout failure", stderr: "" }
      : { code: 0, stdout: "", stderr: "" },
  );
  await expect(
    deploy({
      target: "testuser@test-router.example.test",
      config: "/tmp/config.boot",
      verify: true,
    }),
  ).rejects.toThrow("verification phase failed (show vrrp): verification stdout failure");
});
