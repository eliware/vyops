import { validateScript } from "../../src/bundle/script-validation.mjs";

test.each([
  ["plain.txt", "data\n", 0o644],
  ["helper.sh", "#!/bin/sh\n", 0o644],
  ["tool.exe", Buffer.from([0, 1, 2]), 0o644],
  ["commit/post-hooks.d/hook", "#!/bin/vbash\n", 0o644],
  ["vyos-preconfig-bootup.script", "#!/usr/bin/env bash\n", 0o644],
])("accepts supported script %s", (name, content, mode) => {
  expect(() => validateScript(name, Buffer.from(content), mode)).not.toThrow();
});

test.each([
  ["../escape", "data", 0o644, "path is invalid"],
  ["cert.pub", "data\r\n", 0o644, "contains CR bytes"],
  ["bad.sh", "echo bad\n", 0o755, "no shebang"],
  ["bad.sh", "#!/usr/bin/python\n", 0o755, "unsupported interpreter"],
])("rejects invalid script %s", (name, content, mode, message) => {
  expect(() => validateScript(name, Buffer.from(content), mode)).toThrow(message);
});
