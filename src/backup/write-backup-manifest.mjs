export async function writeBackupManifest(fs, path, staged, files) {
  const manifest = ["kind\tpath", ...files.map((name) => `file\t${name}`)].join("\n") + "\n";
  await fs.writeFile(path(staged, "config.boot.manifest.tsv"), manifest, {
    encoding: "utf8",
    mode: 0o600,
  });
}
