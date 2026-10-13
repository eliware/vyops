import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { setupDeployHarness } from "../../test-fixtures/deploy-harness.mjs";
import { jest } from "@jest/globals";
test("returns an empty managed path set when no manifest exists", async () => {
  const { inspectLiveScripts } = await import("../../src/deploy/inspect-live-scripts.mjs");
  const result = await inspectLiveScripts({}, "missing-config");
  expect(result).toEqual(new Set());
});

const { mocks } = await setupDeployHarness(jest);
const { inspectLiveScripts } = await import("../../src/deploy/inspect-live-scripts.mjs");

test.each([
  ["stderr", "permission denied", "", "permission denied"],
  ["stdout", "", "inspection output", "inspection output"],
  ["empty output", "", "", "live script inspection failed"],
])("reports live script scan failures from %s", async (_label, stderr, stdout, message) => {
  const root = await mkdtemp(join(tmpdir(), "vyops-inspection-"));
  const config = join(root, "config.boot");
  await writeFile(`${config}.deployment.tsv`, "file\tmanaged.sh\n");
  mocks.exec.mockResolvedValueOnce({ code: 1, stderr, stdout });
  try {
    await expect(inspectLiveScripts({}, config)).rejects.toThrow(
      `live script inspection failed: ${message}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
