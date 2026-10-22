import { jest } from "@jest/globals";
import { deploymentManifestHeader } from "../../../src/manifest/columns.mjs";
const { writeDeploymentManifest } =
  await import("../../../src/backup/write/deployment-manifest.mjs");

test("writes one complete deployment record for each backup script", async () => {
  const fs = { writeFile: jest.fn() };
  const files = [{ name: "hook.sh", mode: "755", sha256: "a".repeat(64), type: "regular file" }];
  const directories = [{ name: "commit", mode: "2755", type: "directory" }];
  await writeDeploymentManifest(
    fs,
    (...parts) => parts.join("/"),
    "/tmp/staged",
    directories,
    files,
  );
  expect(fs.writeFile).toHaveBeenCalledWith(
    "/tmp/staged/config.boot.deployment.tsv",
    `${deploymentManifestHeader}\ndirectory\tcommit\ttrue\t2755\t-\tdirectory\t2755\t-\tdirectory\nfile\thook.sh\ttrue\t755\t${"a".repeat(64)}\tregular file\t755\t${"a".repeat(64)}\tregular file\n`,
    { encoding: "utf8", mode: 0o600 },
  );
});

test("writes a header when the router has no scripts", async () => {
  const fs = { writeFile: jest.fn() };
  await writeDeploymentManifest(fs, (...parts) => parts.join("/"), "/tmp/staged", [], []);
  expect(fs.writeFile.mock.calls[0][1]).toBe(`${deploymentManifestHeader}\n`);
});
