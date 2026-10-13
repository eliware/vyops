import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAndValidateConfig } from "../../src/validate/config-file.mjs";

test("reads and validates the configuration file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "vyops-validate-"));
  const path = join(directory, "config.boot");
  const config = "system {\n    host-name router\n}\n";
  await writeFile(path, config);
  try {
    await expect(readAndValidateConfig(path)).resolves.toBe(config);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
