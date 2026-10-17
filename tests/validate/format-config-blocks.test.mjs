const { formatConfigBlocks } = await import("../../src/validate/format-config-blocks.mjs");

test("sorts consecutive blocks and formats nested statements", () => {
  expect(
    formatConfigBlocks([
      { type: "block", key: "item 10 {", children: [] },
      { type: "block", key: "item 2 {", children: [{ type: "statement", value: "value test" }] },
    ]),
  ).toEqual(["item 2 {", "    value test", "}", "item 10 {", "}"]);
});

test("keeps statements and comments between block groups", () => {
  expect(
    formatConfigBlocks([
      { type: "block", key: "zeta {", children: [] },
      { type: "comment", value: "# divider" },
      { type: "block", key: "alpha {", children: [] },
    ]),
  ).toEqual(["zeta {", "}", "# divider", "alpha {", "}"]);
});
