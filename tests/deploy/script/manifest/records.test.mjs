import { deploymentManifestHeader } from "../../../../src/manifest/columns.mjs";
import { parseDeploymentRecords } from "../../../../src/deploy/script/manifest/records.mjs";

const manifest = (records = "") => `${deploymentManifestHeader}\n${records}`;

test("parses valid file and directory records", () => {
  const content = manifest(
    "directory\tnested\tfalse\t-\t-\tdirectory\t755\t-\tdirectory\n" +
      "file\tnested/hook.sh\tfalse\t-\t-\t-\t755\thash\tregular file\n",
  );
  expect(parseDeploymentRecords(content)).toHaveLength(2);
});

test.each([
  ["file\thook.sh\tfalse\n", /invalid header/],
  [manifest("file\thook.sh\tfalse\n"), /malformed record/],
  [manifest("other\thook.sh\tfalse\t-\t-\t-\t755\thash\tregular file\n"), /malformed record/],
  [manifest("file\t\tfalse\t-\t-\t-\t755\thash\tregular file\n"), /malformed record/],
  [manifest("file\t../escape\tfalse\t-\t-\t-\t755\thash\tregular file\n"), /unsafe script path/],
  [
    manifest(
      "file\thook.sh\tfalse\t-\t-\t-\t755\thash\tregular file\n" +
        "file\thook.sh\tfalse\t-\t-\t-\t755\thash\tregular file\n",
    ),
    /duplicate script path/,
  ],
])("rejects invalid deployment records", (content, error) => {
  expect(() => parseDeploymentRecords(content)).toThrow(error);
});
