import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import stringifySafe from "json-stringify-safe";
import { MemSavvyQueue } from "memory-savvy-queue";
import os from "node:os";
import { config } from "./config";
import { AnyObject, onlyDefinedFields } from "./misc";

dayjs.extend(utc);
dayjs.extend(timezone);

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "off";

const logLevels: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal", "off"];

export type SimpleLoggerConfig = {
  logLevel?: LogLevel;
  jsonIndent?: number;
};

export class SimpleLogger {
  private time = Date.now();
  private entryCounter = 0;
  protected config: Required<SimpleLoggerConfig>;

  constructor(cfg?: SimpleLoggerConfig) {
    this.config = SimpleLogger.createConfig(cfg);
  }

  protected createEntry(level: LogLevel, message: string, data: AnyObject) {
    const time = Date.now();
    const timer = time - this.time;
    this.time = time;
    const isoTime = dayjs(time).tz(config.timezone).format();
    const heapUsed = `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100} MB`;
    const memoryAllocated = `${Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100} MB`;

    return { id: this.entryCounter++, level, time, isoTime, timer, heapUsed, memoryAllocated, message, ...data };
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
    return { logLevel: defaultLogLevel, jsonIndent: config.jsonIndent, ...cfg };
  }
}

export type ContextAwareLoggerConfig = {
  memoryLimit?: number;
  flushTimeout?: number;
} & SimpleLoggerConfig;

export class ContextAwareLogger extends SimpleLogger {
  private entries: MemSavvyQueue<{ id: number }>;
  private context: AnyObject = {};
  protected config: Required<ContextAwareLoggerConfig>;

  constructor(cfg?: ContextAwareLoggerConfig) {
    super(cfg);

    this.config = {
      ...SimpleLogger.createConfig(cfg),
      memoryLimit: config.memoryLimit,
      flushTimeout: config.flushTimeout,
      ...cfg,
    };

    this.entries = new MemSavvyQueue<{ id: number }>({
      memoryUsageLimitBytes: this.config.memoryLimit * 1024 * 1024,
      itemConsumer: async (item) => {
        process.stdout.write(
          stringifySafe({ ...item, ...this.context }, null, this.config.jsonIndent) + os.EOL,
        );
      },
    });

    if (this.config.flushTimeout < Number.MAX_SAFE_INTEGER) {
      setTimeout(() => this.flush(), this.config.flushTimeout * 1000);
    }
  }

  public log(level: LogLevel, message: string, data: AnyObject) {
    if (this.isLogLevelEnabled(level)) {
      this.entries.push(this.createEntry(level, message, data));
    }
  }

  public setContext(context: AnyObject) {
    this.context = context;
  }

  public patchContext(context: AnyObject) {
    this.context = { ...this.context, ...onlyDefinedFields(context) };
  }

  public flush() {
    this.entries.consumeAll();
  }
}
