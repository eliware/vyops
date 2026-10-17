import { bundleManifestHeader } from "../manifest/columns.mjs";

export async function writeBackupManifest(fs, path, staged, files) {
  const manifest =
    [bundleManifestHeader, ...files.map((name) => `file\t${name}`)].join("\n") + "\n";
  await fs.writeFile(path(staged, "config.boot.manifest.tsv"), manifest, {
    encoding: "utf8",
    mode: 0o600,
  });
}
