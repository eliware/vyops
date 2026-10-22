import { jest } from "@jest/globals";
const { inspectRemoteScripts } = await import("../../../src/backup/remote/inspection.mjs");

const log = { debug: jest.fn() };

beforeEach(() => jest.clearAllMocks());

test("lists and validates NUL-delimited scripts", async () => {
  const exec = jest
    .fn()
    .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
    .mockResolvedValueOnce({
      code: 0,
      stdout: "/config/scripts/foo.sh\0/config/scripts/nested/bar\0",
      stderr: "",
    })
    .mockResolvedValueOnce({
      code: 0,
      stdout: `755\t${"a".repeat(64)}\tregular file\n`,
      stderr: "",
    })
    .mockResolvedValueOnce({
      code: 0,
      stdout: `755\t${"a".repeat(64)}\tregular file\n`,
      stderr: "",
    })
    .mockResolvedValueOnce({ code: 0, stdout: "755\n", stderr: "" });
  await expect(inspectRemoteScripts(exec, {}, log)).resolves.toEqual({
    files: [
      { name: "foo.sh", mode: "755", sha256: "a".repeat(64), type: "regular file" },
      { name: "nested/bar", mode: "755", sha256: "a".repeat(64), type: "regular file" },
    ],
    directories: [{ name: "nested", mode: "755", type: "directory" }],
  });
  expect(exec).toHaveBeenCalledTimes(5);
  expect(exec.mock.calls[0][1]).toContain("type l");
  expect(exec.mock.calls[1][1]).toContain("type f");
  expect(exec.mock.calls[0][1]).not.toContain("2>/dev/null");
  expect(exec.mock.calls[1][1]).not.toContain("2>/dev/null");
  expect(log.debug).toHaveBeenCalledWith("[vyops] backup: found 2 remote script files");
});

test("accepts a router with no scripts directory", async () => {
  const exec = jest
    .fn()
    .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
    .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });
  await expect(inspectRemoteScripts(exec, {}, log)).resolves.toEqual({
    files: [],
    directories: [],
  });
  expect(exec).toHaveBeenCalledTimes(2);
});

test.each([
  ["file scan stderr", { code: 1, stderr: "denied" }, "could not list remote scripts: denied"],
  [
    "file scan stdout",
    { code: 1, stdout: "find output" },
    "could not list remote scripts: find output",
  ],
])("reports %s", async (_name, failure, message) => {
  const exec = jest
    .fn()
    .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
    .mockResolvedValueOnce(failure);
  await expect(inspectRemoteScripts(exec, {}, log)).rejects.toThrow(message);
});

test("rejects unsafe remote script paths", async () => {
  const unsafe = jest
    .fn()
    .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
    .mockResolvedValueOnce({ code: 0, stdout: "/config/scripts/../secret\0", stderr: "" });
  await expect(inspectRemoteScripts(unsafe, {}, log)).rejects.toThrow("unsafe remote script path");
  const outside = jest
    .fn()
    .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
    .mockResolvedValueOnce({ code: 0, stdout: "/tmp/other\0", stderr: "" });
  await expect(inspectRemoteScripts(outside, {}, log)).rejects.toThrow("unsafe remote script path");
});
