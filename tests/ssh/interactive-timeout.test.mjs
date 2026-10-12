import { jest } from "@jest/globals";
import { startInteractiveTimeout } from "../../src/ssh/interactive-timeout.mjs";

afterEach(() => {
  jest.useRealTimers();
  delete process.env.VYOPS_INTERACTIVE_TIMEOUT;
});

test("uses the configured timeout and reports connection context", () => {
  jest.useFakeTimers();
  process.env.VYOPS_INTERACTIVE_TIMEOUT = "25";
  const state = {
    index: 0,
    waiting: false,
    answering: false,
    settled: false,
    timedOut: false,
    response: "partial",
    currentItem: { command: "show version" },
  };
  const reject = jest.fn();
  const stream = { close: jest.fn() };
  startInteractiveTimeout({
    operation: "operation-id",
    commands: ["show version"],
    state,
    stream,
    client: {
      __vyopsDeploymentId: "deployment",
      __vyopsTarget: "vyos@router",
      __vyopsPhase: "connect",
    },
    log: jest.fn(),
    reject,
  });
  jest.advanceTimersByTime(25);
  expect(state).toMatchObject({ settled: true, timedOut: true });
  expect(stream.close).toHaveBeenCalled();
  expect(reject).toHaveBeenCalledWith(
    expect.objectContaining({
      code: "VYOPS_TIMEOUT",
      message:
        "Interactive SSH timed out [operation-id] (deployment=deployment target=vyos@router phase=connect): show version",
    }),
  );
});

test.each([
  ["invalid", undefined, "none"],
  ["0", "command", "command"],
  ["bad", { command: "other" }, "other"],
])("uses the default timeout for %s", (value, currentItem, command) => {
  jest.useFakeTimers();
  process.env.VYOPS_INTERACTIVE_TIMEOUT = value;
  const reject = jest.fn();
  startInteractiveTimeout({
    operation: "id",
    commands: [],
    state: {
      index: 0,
      waiting: false,
      answering: false,
      settled: false,
      timedOut: false,
      response: "",
      currentItem,
    },
    stream: { close: jest.fn() },
    client: {},
    log: jest.fn(),
    reject,
  });
  jest.advanceTimersByTime(60000);
  expect(reject.mock.calls[0][0]).toMatchObject({
    code: "VYOPS_TIMEOUT",
    message: new RegExp(`: ${command}$`),
  });
});
