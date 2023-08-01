import stringifySafe from "json-stringify-safe";
import { MemSavvyQueue } from "memory-savvy-queue";
import os from "node:os";
import { AnyObject, onlyDefinedFields } from "./misc";

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

  constructor(config?: SimpleLoggerConfig) {
    this.config = SimpleLogger.createConfig(config);
  }

  protected createEntry(level: LogLevel, message: string, data: AnyObject) {
    const time = Date.now();
    const timer = time - this.time;
    this.time = time;
    const heapUsed = `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100} MB`;
    const memoryAllocated = `${Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100} MB`;

    return { id: this.entryCounter++, level, time, timer, heapUsed, memoryAllocated, message, ...data };
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

  protected static createConfig(config?: SimpleLoggerConfig) {
    const logLevelString = (process.env.LOG_LEVEL || "info").toLowerCase();
    const defaultLogLevel = logLevels.find((it) => it === logLevelString) || "info";
    return { logLevel: defaultLogLevel, jsonIndent: 0, ...config };
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

  constructor(config?: ContextAwareLoggerConfig) {
    super(config);

    this.config = {
      ...SimpleLogger.createConfig(config),
      memoryLimit: parseInt(process.env.LOG_MEMORY_LIMIT_MB || "1"),
      flushTimeout: parseInt(process.env.LOG_FLUSH_TIMEOUT_S || "0"),
      ...config,
    };

    this.entries = new MemSavvyQueue<{ id: number }>({
      memoryUsageLimitBytes: this.config.memoryLimit * 1024 * 1024,
      itemConsumer: async (item) => {
        process.stdout.write(
          stringifySafe({ ...item, ...this.context }, null, this.config.jsonIndent) + os.EOL,
        );
      },
    });

    if (this.config.flushTimeout > 0) {
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
