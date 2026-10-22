export function groupConfigBraces(braces) {
  return {
    opening: braces.filter(({ character }) => character === "{"),
    closing: braces.filter(({ character }) => character === "}"),
    ordered: braces,
  };
}
