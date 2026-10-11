export function deploymentPaths(configPath) {
  return [configPath, `${configPath}.manifest.tsv`, `${configPath}.deployment.tsv`];
}
