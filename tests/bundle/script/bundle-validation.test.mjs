import {
  filesystem,
  promises,
  resetMemoryFilesystem,
} from "../../../test-fixtures/helpers/memory-filesystem.mjs";
import { jest } from "@jest/globals";
beforeEach(() => resetMemoryFilesystem());
jest.unstable_mockModule("node:fs", () => filesystem);
jest.unstable_mockModule("node:fs/promises", () => promises);
const { chmod, mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises");
const { join } = await import("node:path");
const { validateBundleScripts } = await import("../../../src/bundle/script/bundle-validation.mjs");

async function bundleDirectory() {
  const root = await mkdtemp(join("/virtual", "vyops-bundle-"));
  await mkdir(join(root, "scripts"), { recursive: true });
  return root;
}

test.each([
  ["bad.sh", "echo bad\n", 0o755, "no shebang"],
  ["bad.sh", "#!/usr/bin/python\n", 0o755, "unsupported interpreter"],
  ["bad.sh", "#!/bin/sh\r\necho bad\r\n", 0o755, "CR bytes"],
])("rejects invalid executable script %s", async (name, content, mode, message) => {
  const root = await bundleDirectory();
  try {
    const file = join(root, "scripts", name);
    await writeFile(file, content);
    await chmod(file, mode);
    await expect(validateBundleScripts(join(root, "config.boot"))).rejects.toThrow(message);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects CRLF in non-executable text files", async () => {
  const root = await bundleDirectory();
  try {
    await writeFile(join(root, "scripts", "host-cert.pub"), "ssh-ed25519 AAAA\r\n");
    await expect(validateBundleScripts(join(root, "config.boot"))).rejects.toThrow(
      "preflight failed: scripts/host-cert.pub contains CR bytes. Convert to LF.",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("accepts supported binaries and executable hook names", async () => {
  const root = await bundleDirectory();
  try {
    await mkdir(join(root, "scripts", "commit", "post-hooks.d"), { recursive: true });
    await writeFile(join(root, "scripts", "tool.exe"), Buffer.from([0, 1, 2]));
    await writeFile(join(root, "scripts", "commit", "post-hooks.d", "hook"), "#!/bin/vbash\n");
    await expect(validateBundleScripts(join(root, "config.boot"))).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "tool.exe" })]),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects unsafe paths from filesystem entries", async () => {
  const fsApi = {
    readdir: async () => [{ name: "..", isDirectory: () => false, isFile: () => true }],
    readFile: jest.fn(),
    stat: jest.fn(),
  };
  await expect(validateBundleScripts("/tmp/config.boot", fsApi)).rejects.toThrow("path is invalid");
  expect(fsApi.readFile).not.toHaveBeenCalled();
});

test("propagates traversal errors", async () => {
  const fsApi = {
    readdir: async () => {
      throw Object.assign(new Error("denied"), { code: "EACCES" });
    },
  };
  await expect(validateBundleScripts("/tmp/config.boot", fsApi)).rejects.toThrow("denied");
});

test("validates a bundle without scripts", async () => {
  await expect(validateBundleScripts("/tmp/config.boot")).resolves.toEqual([]);
});
