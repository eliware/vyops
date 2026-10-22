export function formatRepositorySnapshot(state) {
  return `${state.head}\n${state.branch}\n${state.upstream}\n${state.stagedDeploymentPaths}${state.status}`;
}
