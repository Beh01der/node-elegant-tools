import stringifySafe from "json-stringify-safe";
import { MemSavvyQueue } from "memory-savvy-queue";
import os from "node:os";
import { AnyObject, onlyDefinedFields } from "./misc";

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "off";

const logLevels: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal", "off"];

const getDefaultLogLevel = () => {
  const logLevelString = (process.env.LOG_LEVEL || "info").toLowerCase();
  return logLevels.find((it) => it === logLevelString) || "info";
};

export class SimpleLogger {
  private time = Date.now();
  private entryCounter = 0;

  constructor(protected logLevel: LogLevel = getDefaultLogLevel()) {}

  protected createEntry(level: LogLevel, message: string, data: AnyObject) {
    const time = Date.now();
    const timer = time - this.time;
    this.time = time;
    const heapUsed = `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100} MB`;

    return { id: this.entryCounter++, level, time, timer, heapUsed, message, ...data };
  }

  public isLogLevelEnabled(level: LogLevel) {
    return logLevels.indexOf(level) >= logLevels.indexOf(this.logLevel);
  }

  public log(level: LogLevel, message: string, data: AnyObject) {
    if (this.isLogLevelEnabled(level)) {
      process.stdout.write(stringifySafe(this.createEntry(level, message, data), null, 2) + os.EOL);
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
}

export type ContextAwareLoggerConfig = {
  logLevel?: LogLevel;
  memoryLimit?: number;
  flushTimeout?: number;
};

export class ContextAwareLogger extends SimpleLogger {
  private entries: MemSavvyQueue<{ id: number }>;
  private config: Required<ContextAwareLoggerConfig>;
  private context: AnyObject = {};

  constructor(config?: ContextAwareLoggerConfig) {
    super(config?.logLevel);

    this.config = {
      logLevel: this.logLevel,
      memoryLimit: parseInt(process.env.LOG_MEMORY_LIMIT_MB || "1"),
      flushTimeout: parseInt(process.env.LOG_FLUSH_TIMEOUT_S || "0"),
      ...config,
    };

    this.entries = new MemSavvyQueue<{ id: number }>({
      memoryUsageLimitBytes: this.config.memoryLimit * 1024 * 1024,
      itemConsumer: async (item) => {
        process.stdout.write(stringifySafe({ ...item, ...this.context }, null, 2) + os.EOL);
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
