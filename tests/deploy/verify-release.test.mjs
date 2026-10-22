import { jest } from "@jest/globals";
const { verifyRelease } = await import("../../src/deploy/verify-release.mjs");

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
