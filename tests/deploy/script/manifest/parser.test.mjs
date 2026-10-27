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
