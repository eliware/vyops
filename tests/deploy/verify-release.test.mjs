import { jest } from "@jest/globals";
const { verifyRelease } = await import("../../src/deploy/verify-release.mjs");
const { setupDeployHarness } = await import("../../test-fixtures/deploy-harness.mjs");
const { verificationCommands, setVerificationResults } =
  await import("../../test-fixtures/deployment-verification.mjs");

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

test("rejects unavailable text when a verification command also reports an error", async () => {
  const exec = jest.fn().mockResolvedValue({
    code: 1,
    stdout: "VRRP data is not available (process not running or no active groups)",
    stderr: "permission denied",
  });
  await expect(verifyRelease({}, exec, { info: jest.fn() }, (value) => value)).rejects.toThrow(
    "verification phase failed (show vrrp)",
  );
});

const { mocks, deploy } = await setupDeployHarness(jest);
const verifiedDeploy = () =>
  deploy({ target: "testuser@test-router.example.test", config: "/tmp/config.boot", verify: true });

test("runs optional post-deployment verification commands", async () => {
  await expect(verifiedDeploy()).resolves.toBe(0);
  expect(verificationCommands(mocks).join(",")).toBe(
    "show vrrp,show interfaces wireguard,show bgp summary,show ip route,show haproxy",
  );
});

test("continues when optional router services are absent", async () => {
  const absent = new Map([
    ["show vrrp", "VRRP data is not available (process not running or no active groups)"],
    ["show interfaces wireguard", "Interface        IP Address\n---------        ----------\n"],
    ["show bgp summary", "% BGP instance not found"],
    ["show haproxy", "Haproxy is not configured"],
  ]);
  setVerificationResults(mocks, (check) =>
    absent.has(check) ? { code: 1, stdout: absent.get(check), stderr: "" } : undefined,
  );
  await expect(verifiedDeploy()).resolves.toBe(0);
});

test.each([
  ["stderr", "", "verification failed"],
  ["stdout", "verification stdout failure", ""],
])("fails when verification returns an error on %s", async (_stream, stdout, stderr) => {
  setVerificationResults(mocks, () => ({ code: 1, stdout, stderr }));
  await expect(verifiedDeploy()).rejects.toThrow(
    `verification phase failed (show vrrp): ${stdout || stderr}`,
  );
});
