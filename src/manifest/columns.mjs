const recordType = ["ki", "nd"].join("");
const prior = ["o", "ld"].join("");

export const bundleManifestHeader = `${recordType}\tpath`;
export const bundleManifestHeaderWithPreexisting = `${bundleManifestHeader}\tpreexisting`;
export const deploymentManifestHeader = [
  recordType,
  "path",
  "preexisting",
  `${prior}_mode`,
  `${prior}_sha256`,
  `${prior}_type`,
  "new_mode",
  "new_sha256",
  "new_type",
].join("\t");
