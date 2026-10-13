import { jest } from "@jest/globals";
import { inspectRemoteScripts } from "../../src/backup/remote-inspection.mjs";

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
    .mockResolvedValue({ code: 0, stdout: "", stderr: "" });
  await expect(inspectRemoteScripts(exec, {}, log)).resolves.toEqual(["foo.sh", "nested/bar"]);
  expect(exec).toHaveBeenCalledTimes(4);
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
  await expect(inspectRemoteScripts(exec, {}, log)).resolves.toEqual([]);
  expect(exec).toHaveBeenCalledTimes(2);
});

test.each([
  [
    "link scan stderr",
    true,
    { code: 1, stderr: "denied" },
    "could not inspect remote scripts: denied",
  ],
  [
    "link scan stdout",
    true,
    { code: 1, stdout: "find output" },
    "could not inspect remote scripts: find output",
  ],
  [
    "file scan stderr",
    false,
    { code: 1, stderr: "denied" },
    "could not list remote scripts: denied",
  ],
  [
    "file scan stdout",
    false,
    { code: 1, stdout: "find output" },
    "could not list remote scripts: find output",
  ],
])("reports %s errors", async (_name, linkScan, failure, message) => {
  const exec = jest.fn();
  if (linkScan) exec.mockResolvedValueOnce(failure);
  else {
    exec.mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" }).mockResolvedValueOnce(failure);
  }
  await expect(inspectRemoteScripts(exec, {}, log)).rejects.toThrow(message);
});

test("rejects remote links and unsafe script paths", async () => {
  const links = jest.fn().mockResolvedValue({ code: 0, stdout: "/config/scripts/link\0" });
  await expect(inspectRemoteScripts(links, {}, log)).rejects.toThrow(
    "remote script symlink rejected",
  );
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
