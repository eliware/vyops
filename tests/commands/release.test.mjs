import { jest } from "@jest/globals";
const { prepareRelease } = await import("../../src/commands/release.mjs");
test("prepares release capabilities and warnings", async () => {
  const log = { info: jest.fn(), warn: jest.fn() };
  const args = {
    config: "/tmp/config.boot",
    operationId: "op",
    noHooks: true,
    noPushback: true,
    verify: true,
  };
  await prepareRelease(
    args,
    {
      target: "vyos@router",
      scripts: ["hooks/haproxy.sh", "tool.exe"],
    },
    log,
  );
  expect(args).toMatchObject({
    target: "vyos@router",
    hasHaproxyHooks: true,
    hasBinaryScripts: true,
  });
  expect(log.warn).toHaveBeenCalledTimes(2);
});

test("prepares a release without optional hooks, verification, or pushback warnings", async () => {
  const log = { info: jest.fn(), warn: jest.fn() };
  const args = {
    config: "/tmp/config.boot",
    operationId: "op-2",
    noHooks: false,
    noPushback: false,
    verify: false,
  };
  await prepareRelease(args, { target: "vyos@router", scripts: ["notify.sh"] }, log);
  expect(args).toMatchObject({
    target: "vyos@router",
    hasHaproxyHooks: false,
    hasBinaryScripts: false,
  });
  expect(log.info).toHaveBeenCalledWith(expect.stringContaining("hooks: enabled"));
  expect(log.info).toHaveBeenCalledWith(expect.stringContaining("verification: disabled"));
  expect(log.info).toHaveBeenCalledWith(expect.stringContaining("pushback: enabled"));
  expect(log.warn).not.toHaveBeenCalled();
});
