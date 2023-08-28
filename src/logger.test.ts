import process from "node:process";
import { setTimeout } from "timers/promises";
import { ContextAwareLogger, SimpleLogger } from "./logger";

const KNOWN_DATE = new Date("2023-08-27T00:00:00.000Z");

jest.useFakeTimers({ now: KNOWN_DATE });

jest.mock("node:process", () => ({
  stdout: { write: jest.fn() },
  memoryUsage: jest.fn(() => ({
    rss: 28835840,
    heapTotal: 16515072,
    heapUsed: 13818448,
    external: 8272,
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SimpleLogger", () => {
  it("should respect logLevel", () => {
    const logger = new SimpleLogger({ logLevel: "warn" });
    logger.trace("trace");
    logger.debug("debug");
    logger.info("info");

    logger.warn("warn");
    logger.error("error");
    logger.fatal("fatal");

    expect(process.stdout.write).toHaveBeenCalledTimes(3);
    expect((process.stdout.write as any).mock.calls.map((it: any) => JSON.parse(it[0]).message)).toEqual([
      "warn",
      "error",
      "fatal",
    ]);
  });

  it("should respect jsonIndent", () => {
    const logger0 = new SimpleLogger({ logLevel: "info", jsonIndent: 0 });
    const logger2 = new SimpleLogger({ logLevel: "info", jsonIndent: 2 });
    logger0.info("Hello logger0");
    logger2.info("Hello logger2");

    expect((process.stdout.write as any).mock.calls.map((it: any) => it[0])).toEqual([
      `{"pos":0,"level":"info","time":1693094400000,"isoTime":"2023-08-27T10:00:00+10:00","timer":0,"heapUsed":"13.18 MB",`
      + `"memoryAllocated":"27.5 MB","message":"Hello logger0"}\n`,
      `{\n`
      + `  "pos": 0,\n`
      + `  "level": "info",\n`
      + `  "time": 1693094400000,\n`
      + `  "isoTime": "2023-08-27T10:00:00+10:00",\n`
      + `  "timer": 0,\n`
      + `  "heapUsed": "13.18 MB",\n`
      + `  "memoryAllocated": "27.5 MB",\n`
      + `  "message": "Hello logger2"\n`
      + `}\n`,
    ]);
  });

  it("should respect timezone", () => {
    const logger_nw = new SimpleLogger({ logLevel: "info", timezone: "America/New_York" });
    const logger_sy = new SimpleLogger({ logLevel: "info", timezone: "Australia/Sydney" });
    logger_nw.info("Hello, New York!");
    logger_sy.info("Hello, Sydney!");

    expect((process.stdout.write as any).mock.calls.map((it: any) => JSON.parse(it[0]).isoTime)).toEqual([
      "2023-08-26T20:00:00-04:00",
      "2023-08-27T10:00:00+10:00",
    ]);
  });
});

describe("ContextAwareLogger", () => {
  it("should add context to all log entries", async () => {
    const logger = new ContextAwareLogger({ logLevel: "info" });
    logger.setContext({ contextData: "contextValue" });
    logger.info("Going once", { auctionCounter: 1 });

    logger.patchContext({ newContextData: "newContextValue" });
    logger.info("Going twice", { auctionCounter: 2 });

    expect(process.stdout.write).toHaveBeenCalledTimes(0);
    await logger.flush();

    expect((process.stdout.write as any).mock.calls.map((it: any) => JSON.parse(it[0]))).toEqual([
      {
        pos: 0,
        level: "info",
        time: 1693094400000,
        isoTime: "2023-08-27T10:00:00+10:00",
        timer: 0,
        heapUsed: "13.18 MB",
        memoryAllocated: "27.5 MB",
        message: "Going once",
        auctionCounter: 1,
        contextData: "contextValue",
        newContextData: "newContextValue",
      },
      {
        pos: 1,
        level: "info",
        time: 1693094400000,
        isoTime: "2023-08-27T10:00:00+10:00",
        timer: 0,
        heapUsed: "13.18 MB",
        memoryAllocated: "27.5 MB",
        message: "Going twice",
        auctionCounter: 2,
        contextData: "contextValue",
        newContextData: "newContextValue",
      },
    ]);
  });

  it("should flush entries on memory limit", async () => {
    const logger = new ContextAwareLogger({ logLevel: "info", memoryLimit: 1 });
    for (let i = 0; i < 3; i++) {
      logger.info(`Log entry #${i}`, { heapsOfData: "x".repeat(1024 * 1024) });
    }

    expect(process.stdout.write).toHaveBeenCalledTimes(3);
    await logger.flush();
    expect(process.stdout.write).toHaveBeenCalledTimes(3);
  });

  it("should flush entries on timeout", async () => {
    const logger = new ContextAwareLogger({ logLevel: "info", flushTimeout: 1 });
    logger.info("Log something");

    expect(process.stdout.write).toHaveBeenCalledTimes(0);
    await setTimeout(1100);
    expect(process.stdout.write).toHaveBeenCalledTimes(1);
  });

  it("should output entries immediatelly for INSTANT output strategy", () => {
    const logger = new ContextAwareLogger({ logLevel: "info", outputStrategy: "INSTANT" });
    logger.info("Log something");
    expect(process.stdout.write).toHaveBeenCalledTimes(1);

    logger.info("Log something else");
    expect(process.stdout.write).toHaveBeenCalledTimes(2);
  });

  it("should switch to immediate output after flush() is called for INSTANT_AFTER_FLUSH output strategy", async () => {
    const logger = new ContextAwareLogger({ logLevel: "info", outputStrategy: "INSTANT_AFTER_FLUSH" });
    logger.info("Log something");
    expect(process.stdout.write).toHaveBeenCalledTimes(0);
    await logger.flush();
    expect(process.stdout.write).toHaveBeenCalledTimes(1);

    logger.info("Log something else");
    expect(process.stdout.write).toHaveBeenCalledTimes(2);
  });

  it("should always require flush() for ALWAYS_CASHED output strategy", async () => {
    const logger = new ContextAwareLogger({ logLevel: "info", outputStrategy: "ALWAYS_CACHED" });
    logger.info("Log something");
    expect(process.stdout.write).toHaveBeenCalledTimes(0);
    await logger.flush();
    expect(process.stdout.write).toHaveBeenCalledTimes(1);

    logger.info("Log something else");
    expect(process.stdout.write).toHaveBeenCalledTimes(1);
    await logger.flush();
    expect(process.stdout.write).toHaveBeenCalledTimes(2);
  });
});
