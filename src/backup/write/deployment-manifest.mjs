import { deploymentManifestHeader } from "../../manifest/columns.mjs";
import { naturalCompare } from "../../validate/natural-compare.mjs";

export async function writeDeploymentManifest(fs, path, staged, directories, files) {
  const records = [
    ...directories.map((file) => ({ ...file, kind: "directory" })),
    ...files.map((file) => ({ ...file, kind: "file" })),
  ]
    .sort((first, second) => naturalCompare(first.name, second.name))
    .map(({ kind, name, mode, sha256 = "-", type }) =>
      [kind, name, "true", mode, sha256, type, mode, sha256, type].join("\t"),
    );
  const manifest = [deploymentManifestHeader, ...records].join("\n") + "\n";
  await fs.writeFile(path(staged, "config.boot.deployment.tsv"), manifest, {
    encoding: "utf8",
    mode: 0o600,
  });
}
