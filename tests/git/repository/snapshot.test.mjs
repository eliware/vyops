import { formatRepositorySnapshot } from "../../../src/git/repository/snapshot.mjs";

test("formats collected repository fields as a stable snapshot", () => {
  expect(
    formatRepositorySnapshot({
      head: "head",
      branch: "main",
      upstream: "origin/main",
      stagedDeploymentPaths: "M\tconfig.boot\n",
      status: " M other.txt\n",
    }),
  ).toBe("head\nmain\norigin/main\nM\tconfig.boot\n M other.txt\n");
});
