import stringifySafe from "json-stringify-safe";
import { MemSavvyQueue } from "memory-savvy-queue";
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

  constructor(private logLevel: LogLevel = getDefaultLogLevel()) {}

  protected createEntry(level: LogLevel, message: string, data: AnyObject) {
    const time = Date.now();
    const timer = time - this.time;
    this.time = time;

    return { id: this.entryCounter++, level, time, timer, message, ...data };
  }

  public isLogLevelEnabled(level: LogLevel) {
    return logLevels.indexOf(level) >= logLevels.indexOf(this.logLevel);
  }

  public log(level: LogLevel, message: string, data: AnyObject) {
    if (this.isLogLevelEnabled(level)) {
      console.log(stringifySafe(this.createEntry(level, message, data), null, 2));
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

export class ContextAwareLogger extends SimpleLogger {
  private entries = new MemSavvyQueue<{ id: number }>({
    memoryUsageLimitBytes: (process.env.LOG_MEMORY_LIMIT ? parseInt(process.env.LOG_MEMORY_LIMIT) : 1) * 1024 * 1024,
    itemConsumer: async (item) => {
      console.log(stringifySafe({ ...item, ...this.context }, null, 2));
    },
  });

  private context: AnyObject = {};

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
