import { extractConfigBlock } from "./config-block/extract.mjs";
import { findConfigBlockOpening } from "./config-block/lookup.mjs";

export function configBlock(source, name) {
  return extractConfigBlock(source, findConfigBlockOpening(source, name));
}
