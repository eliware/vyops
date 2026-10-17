const { relocateHeaderComments } = await import("../../src/validate/header-comments.mjs");

test("moves leading slash comments after formatted config content", () => {
  expect(relocateHeaderComments(["// first", "// second", "", "system {", "}", ""])).toEqual([
    "system {",
    "}",
    "",
    "",
    "// first",
    "// second",
  ]);
});

test("keeps other comments in place and trims outer blank lines", () => {
  expect(relocateHeaderComments(["", "# config comment", "system {", "}", ""])).toEqual([
    "# config comment",
    "system {",
    "}",
  ]);
});
