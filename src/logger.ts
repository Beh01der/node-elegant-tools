import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import stringifySafe from "json-stringify-safe";
import { MemSavvyQueue } from "memory-savvy-queue";
import os from "node:os";
import process from "node:process";
import { config } from "./config";
import { AnyObject, onlyDefinedFields } from "./misc";

dayjs.extend(utc);
dayjs.extend(timezone);

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "off";
export const logLevels: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal", "off"];

export type LogOutputStrategy = "INSTANT" | "INSTANT_AFTER_FLUSH" | "ALWAYS_CACHED";
export const logOutputStrategies: LogOutputStrategy[] = ["INSTANT", "INSTANT_AFTER_FLUSH", "ALWAYS_CACHED"];

export type SimpleLoggerConfig = {
  logLevel?: LogLevel;
  jsonIndent?: number;
  timezone?: string;
  debugLibrary?: boolean;
};

export class SimpleLogger {
  private time = Date.now();
  private entryCounter = 0;
  protected config: Required<SimpleLoggerConfig>;

  constructor(cfg?: SimpleLoggerConfig) {
    this.config = SimpleLogger.createConfig(cfg);
    if (this.config.debugLibrary) {
      this.debug("Using SimpleLogger config", this.config);
    }
  }

  protected createEntry(level: LogLevel, message: string, data: AnyObject) {
    const time = Date.now();
    const timer = time - this.time;
    this.time = time;
    const isoTime = dayjs(time).tz(this.config.timezone).format();
    const heapUsed = `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100} MB`;
    const memoryAllocated = `${Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100} MB`;

    return { pos: this.entryCounter++, level, time, isoTime, timer, heapUsed, memoryAllocated, message, ...data };
  }

  public isLogLevelEnabled(level: LogLevel) {
    return logLevels.indexOf(level) >= logLevels.indexOf(this.config.logLevel);
  }

  public log(level: LogLevel, message: string, data: AnyObject) {
    if (this.isLogLevelEnabled(level)) {
      process.stdout.write(
        stringifySafe(this.createEntry(level, message, data), null, this.config.jsonIndent) + os.EOL,
      );
    }
  }

  public trace(message: string, data: AnyObject = {}) {
    this.log("trace", message, data);
  }

  public debug(message: string, data: AnyObject = {}) {
    this.log("debug", message, data);
  }

  public info(message: string, data: AnyObject = {}) {
    this.log("info", message, data);
  }

  public warn(message: string, data: AnyObject = {}) {
    this.log("warn", message, data);
  }

  public error(message: string, data: AnyObject = {}) {
    const error = data.error || data || {};
    const preparedError = { raw: error.toString?.(), message: error.message, stack: error.stack };
    this.log("error", message, { ...data, error: preparedError });
  }

  public fatal(message: string, data: AnyObject = {}) {
    this.log("fatal", message, data);
  }

  protected static createConfig(cfg?: SimpleLoggerConfig) {
    const defaultLogLevel = logLevels.find((it) => it === cfg?.logLevel) || "info";
    return {
      logLevel: defaultLogLevel,
      jsonIndent: config.jsonIndent,
      timezone: config.timezone,
      debugLibrary: config.debugLibrary,
      ...cfg,
    };
  }
}

export type ContextAwareLoggerConfig = {
  memoryLimit?: number;
  flushTimeout?: number;
  outputStrategy?: LogOutputStrategy;
} & SimpleLoggerConfig;

export class ContextAwareLogger extends SimpleLogger {
  private entries?: MemSavvyQueue<{ pos: number }>;
  private context: AnyObject = {};
  protected config: Required<ContextAwareLoggerConfig>;
  private instantOutput: boolean;

  constructor(cfg?: ContextAwareLoggerConfig) {
    super(cfg);

    this.config = {
      ...SimpleLogger.createConfig(cfg),
      memoryLimit: config.memoryLimit,
      flushTimeout: config.flushTimeout,
      outputStrategy: logOutputStrategies.indexOf(config.logOutputStrategy as LogOutputStrategy) > -1
        ? config.logOutputStrategy as LogOutputStrategy
        : "INSTANT_AFTER_FLUSH" as const,
      ...cfg,
    };

    this.instantOutput = this.config.outputStrategy === "INSTANT";

    if (this.config.outputStrategy !== "INSTANT") {
      this.entries = new MemSavvyQueue<{ pos: number }>({
        memoryUsageLimitBytes: this.config.memoryLimit * 1024 * 1024,
        itemConsumer: async (item) => {
          process.stdout.write(
            stringifySafe({ ...item, ...this.context }, null, this.config.jsonIndent) + os.EOL,
          );
        },
      });

      if (this.config.flushTimeout < Number.MAX_SAFE_INTEGER) {
        setTimeout(async () => this.flush(), this.config.flushTimeout * 1000);
      }
    }

    if (this.config.debugLibrary) {
      this.debug("Using ContextAwareLogger config", this.config);
    }
  }

  public log(level: LogLevel, message: string, data: AnyObject) {
    if (this.isLogLevelEnabled(level)) {
      const item = this.createEntry(level, message, data);

      if (this.instantOutput) {
        process.stdout.write(
          stringifySafe({ ...item, ...this.context }, null, this.config.jsonIndent) + os.EOL,
        );
      } else {
        this.entries?.push(item);
      }
    }
  }

  public setContext(context: AnyObject) {
    this.context = context;
  }

  public patchContext(context: AnyObject) {
    this.context = { ...this.context, ...onlyDefinedFields(context) };
  }

  public async flush() {
    if (!this.instantOutput) {
      if (this.config.debugLibrary) {
        this.debug("ContextAwareLogger processing cached log entries", { count: this.entries?.getCount() });
      }

      await this.entries?.consumeAll();
    }

    if (this.config.outputStrategy === "INSTANT_AFTER_FLUSH") {
      this.instantOutput = true;
    }
  }
}
