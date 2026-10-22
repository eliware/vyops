import { deploymentManifestHeader } from "../../../../src/manifest/columns.mjs";
import { parseDeploymentState } from "../../../../src/deploy/script/manifest/parser.mjs";

const manifest = (records = "") => `${deploymentManifestHeader}\n${records}`;

test("parses managed files and excludes directory records", () => {
  const content = manifest(
    "directory\tnested\tfalse\t-\t-\tdirectory\t755\t-\tdirectory\n" +
      "file\tnested/hook.sh\tfalse\t-\t-\t-\t755\thash\tregular file\n",
  );
  expect(parseDeploymentState(content)).toEqual({
    managed: new Set(["nested/hook.sh"]),
    hasManifest: true,
  });
});

test.each([
  ["existing files", "true", "755\told-hash\tregular file"],
  ["new files", "false", "-\t-\t-"],
])("reads a legacy prior and installed state pair for %s", (_label, preexisting, oldState) => {
  const content = manifest(
    `file\thook.sh\t${preexisting}\t${oldState}\t-\t-\t-\n` +
      "file\thook.sh\t-\t-\t-\t-\t755\tnew-hash\tregular file\n",
  );
  expect(parseDeploymentState(content)).toEqual({
    managed: new Set(["hook.sh"]),
    hasManifest: true,
  });
});

test.each([
  ["file\thook.sh\tfalse\n", /invalid header/],
  [manifest("file\thook.sh\tfalse\n"), /malformed record/],
  [manifest("file\t../escape\tfalse\t-\t-\t-\t755\thash\tregular file\n"), /unsafe script path/],
  [
    manifest(
      "file\thook.sh\tfalse\t-\t-\t-\t755\thash\tregular file\n" +
        "file\thook.sh\tfalse\t-\t-\t-\t755\thash\tregular file\n",
    ),
    /duplicate script path/,
  ],
  [
    manifest(
      "file\thook.sh\tfalse\t755\told-hash\tregular file\t-\t-\t-\n" +
        "file\thook.sh\t-\t-\t-\t-\t755\tnew-hash\tregular file\n",
    ),
    /duplicate script path/,
  ],
  [
    manifest(
      "directory\tnested\ttrue\t755\t-\tdirectory\t-\t-\t-\n" +
        "directory\tnested\t-\t-\t-\t-\t755\t-\tdirectory\n",
    ),
    /duplicate script path/,
  ],
])("rejects an invalid manifest", (content, error) => {
  expect(() => parseDeploymentState(content)).toThrow(error);
});
