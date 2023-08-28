import process from "node:process";
import { setTimeout } from "timers/promises";

import { getContext } from "./context";
import { createHandler } from "./lambda";

const KNOWN_DATE = new Date("2023-08-27T00:00:00.000Z");
const KNOWN_UUID = "96dd45f3-f261-4ec6-9c29-1d21d7300000";

jest.useFakeTimers({ now: KNOWN_DATE });

jest.mock("uuid", () => ({
  v4: jest.fn(() => KNOWN_UUID),
}));

jest.mock("node:process", () => ({
  stdout: { write: jest.fn() },
  memoryUsage: jest.fn(() => ({
    rss: 28835840,
    heapTotal: 16515072,
    heapUsed: 13818448,
    external: 8272,
  })),
}));

jest.mock("node:fs", () => ({
  readFileSync: jest.fn(() => JSON.stringify({ name: "test", version: "1.0.0" })) as any,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createHandler", () => {
  it("calls wrapped function, logs input values and success status", async () => {
    const handler = createHandler(async (event, context) => (`${event}+${context}`));
    const result = await handler("event", "context");

    expect(result).toEqual("event+context");
    expect((process.stdout.write as any).mock.calls.map((it: any) => JSON.parse(it[0]))).toEqual([
      {
        pos: 0,
        level: "info",
        time: 1693094400000,
        isoTime: "2023-08-27T10:00:00+10:00",
        timer: 0,
        heapUsed: "13.18 MB",
        memoryAllocated: "27.5 MB",
        message: "Running test (1.0.0)",
        event: "event",
        context: "context",
        service: "test",
        version: "1.0.0",
        invocationId: "96dd45f3-f261-4ec6-9c29-1d21d7300000",
        result: "success",
      },
      {
        pos: 1,
        level: "info",
        time: 1693094400000,
        isoTime: "2023-08-27T10:00:00+10:00",
        timer: 0,
        heapUsed: "13.18 MB",
        memoryAllocated: "27.5 MB",
        message: "Successfully processed event",
        result: "success",
        service: "test",
        version: "1.0.0",
        invocationId: "96dd45f3-f261-4ec6-9c29-1d21d7300000",
      },
    ]);
  });

  it("should handle / log error", async () => {
    const handler = createHandler(async () => {
      throw new Error("Oh no!");
    });

    await expect(handler("event", "context")).rejects.toThrow("Oh no!");
    expect((process.stdout.write as any).mock.calls.map((it: any) => {
      let result = JSON.parse(it[0]);
      // remove stack trace from error
      if (result.error) {
        result.error = { ...result.error, stack: undefined };
      }
      return result;
    })).toEqual([
      {
        pos: 0,
        level: "info",
        time: 1693094400000,
        isoTime: "2023-08-27T10:00:00+10:00",
        timer: 0,
        heapUsed: "13.18 MB",
        memoryAllocated: "27.5 MB",
        message: "Running test (1.0.0)",
        event: "event",
        context: "context",
        service: "test",
        version: "1.0.0",
        invocationId: "96dd45f3-f261-4ec6-9c29-1d21d7300000",
        result: "failure",
      },
      {
        pos: 1,
        level: "error",
        time: 1693094400000,
        isoTime: "2023-08-27T10:00:00+10:00",
        timer: 0,
        heapUsed: "13.18 MB",
        memoryAllocated: "27.5 MB",
        message: "Failed to process event",
        error: {
          raw: "Error: Oh no!",
          message: "Oh no!",
        },
        service: "test",
        version: "1.0.0",
        invocationId: "96dd45f3-f261-4ec6-9c29-1d21d7300000",
        result: "failure",
      },
    ]);
  });

  it("calls getRemainingTimeInMillis to update flushTimeout and make sure flush() gets called before lambda times out", async () => {
    const lambdaTimeout = 1100;

    const handler = createHandler(async (event, context) => {
      const { logger } = getContext();
      await setTimeout(lambdaTimeout);
      logger.info("Extra log entry");
      return (`${event}+${context}`);
    });

    // we don't wait for handler to finish
    handler("event", { getRemainingTimeInMillis: () => lambdaTimeout });

    // lambda is still running, flush() should not be called
    expect(process.stdout.write).toHaveBeenCalledTimes(0);

    await setTimeout(lambdaTimeout);

    // lambda is about to time out, flush() should be called
    expect(process.stdout.write).toHaveBeenCalledTimes(3);
  });
});
