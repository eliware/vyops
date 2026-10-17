import { jest } from "@jest/globals";
const { remotePreflight } = await import("../../src/deploy/preflight.mjs");

test("checks base router requirements", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0, stdout: "", stderr: "" });
  await remotePreflight(exec, {}, false, false);
  expect(exec.mock.calls[0][1]).toContain("command -v sudo");
});

test("adds HAProxy and binary requirements when requested", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0, stdout: "", stderr: "" });
  await remotePreflight(exec, {}, true, true);
  expect(exec.mock.calls[0][1]).toContain("command -v haproxy");
  expect(exec.mock.calls[0][1]).toContain("command -v file");
});

test.each([
  ["sudo missing", "", "remote preflight failed: sudo missing"],
  ["", "preflight output", "remote preflight failed: preflight output"],
  ["", "", "remote preflight failed: router prerequisites are not satisfied"],
])("reports router prerequisite failure: %s", async (stderr, stdout, expected) => {
  const exec = jest.fn().mockResolvedValue({ code: 1, stdout, stderr });
  await expect(remotePreflight(exec, {}, false, false)).rejects.toThrow(expected);
});
