import { extractCompare } from "./compare.mjs";

export async function runReleaseCommands(interactive, client, remote, log, onConfirmed) {
  let confirmed = false;
  const output = await interactive(
    client,
    [
      "configure",
      {
        phase: "load candidate",
        command: `load ${remote}`,
        reject:
          /(?:load failed|commit failed|commit aborted|cannot commit|configuration (?:commit )?failed|invalid configuration|error|invalid)/i,
      },
      "run set terminal length 0",
      { phase: "compare", command: "printf '%s\\n' '--- compare ---'" },
      { phase: "compare", command: "compare" },
      "printf '%s\\n' '--- end compare ---'",
      {
        phase: "commit-confirm",
        command: "commit-confirm 5",
        reject:
          /(?:commit failed|commit aborted|cannot commit|configuration (?:commit )?failed|invalid configuration)/i,
      },
      { phase: "confirm", command: "confirm", reject: /(?:confirm failed|error|invalid)/i },
      { phase: "save", command: "save", reject: /(?:save failed|error|invalid)/i },
      "exit",
      "exit",
    ],
    log,
    (command) => {
      if (command === "confirm") {
        confirmed = true;
        onConfirmed();
      }
    },
  );
  if (!confirmed) throw new Error("interactive deployment completed without confirming the commit");
  return { output, compare: extractCompare(output) };
}
