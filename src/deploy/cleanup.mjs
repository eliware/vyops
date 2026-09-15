const activeDeploymentCleanups = new Set();

export function registerDeploymentCleanup(cleanup) {
  activeDeploymentCleanups.add(cleanup);
  return () => activeDeploymentCleanups.delete(cleanup);
}

export async function cleanupActiveDeployments() {
  await Promise.all([...activeDeploymentCleanups].map(cleanup => cleanup()));
}
