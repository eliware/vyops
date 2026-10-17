import { jest } from "@jest/globals";
const { removeRemoteStaging } = await import("../../src/deploy/remove-staging.mjs");

test("removes config, scripts, and backup staging paths", async () => {
  const exec = jest.fn().mockResolvedValue({ code: 0 });
  const client = {};
  const paths = { config: "/tmp/config", scripts: "/tmp/scripts", scriptsBackup: "/tmp/backup" };
  await removeRemoteStaging(exec, client, paths);
  expect(exec).toHaveBeenCalledWith(
    client,
    'rm -f -- "/tmp/config" && rm -rf -- "/tmp/scripts" "/tmp/backup"',
  );
});
