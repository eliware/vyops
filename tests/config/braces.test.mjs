import { groupConfigBraces } from "../../src/config/braces.mjs";

test("groups opening and closing braces and retains their order", () => {
  const braces = [
    { character: "{", index: 2 },
    { character: "}", index: 7 },
    { character: "{", index: 9 },
  ];
  expect(groupConfigBraces(braces)).toEqual({
    opening: [braces[0], braces[2]],
    closing: [braces[1]],
    ordered: braces,
  });
});
