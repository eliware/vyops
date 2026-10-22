import {
  promises,
  resetMemoryFilesystem,
} from "../../../test-fixtures/helpers/memory-filesystem.mjs";
import { jest } from "@jest/globals";
await import("../../../test-fixtures/helpers/memory-filesystem-setup.mjs");
beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs/promises", () => promises);
const { mkdtemp, readFile, rm } = await import("node:fs/promises");
import { join } from "node:path";
const { downloadSynchronizedState } =
  await import("../../../src/deploy/local-file/synchronized-state.mjs");

test("replaces config and deployment manifest as one synchronized set", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-synchronized-state-"));
  const config = join(root, "config.boot");
  const configText = "system {}\n";
  const manifestText = "kind\tpath\nfile\thook.sh\n";
  const download = jest.fn(async (_client, remote, temporary) => {
    const content = remote === "/config/config.boot" ? configText : manifestText;
    await promises.writeFile(temporary, content);
  });
  try {
    await downloadSynchronizedState({
      download,
      client: {},
      manifest: "/router/manifest.tsv",
      config,
      finalizeHooks: jest.fn(),
    });
    await expect(readFile(config, "utf8")).resolves.toBe(configText);
    await expect(readFile(`${config}.deployment.tsv`, "utf8")).resolves.toBe(manifestText);
    expect(download.mock.calls.map(([, remote]) => remote)).toEqual([
      "/config/config.boot",
      "/router/manifest.tsv",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("replaces only config when hook finalization is not required", async () => {
  const root = await mkdtemp(join("/virtual", "vyops-synchronized-state-"));
  const config = join(root, "config.boot");
  const download = jest.fn(async (_client, _remote, temporary) => {
    await promises.writeFile(temporary, "system {}\n");
  });
  try {
    await downloadSynchronizedState({ download, client: {}, config, finalizeHooks: null });
    expect(download).toHaveBeenCalledTimes(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
