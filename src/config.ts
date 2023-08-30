export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "off";
export const LOG_LEVELS: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal", "off"];

export type LogOutputStrategy = "instant" | "instant_after_flush" | "always_cached";
export const LOG_OUTPUT_STRATEGIES: LogOutputStrategy[] = ["instant", "instant_after_flush", "always_cached"];

export type SimpleLoggerConfig = {
  logLevel?: LogLevel;
  jsonIndent?: number;
  timezone?: string;
  debugLibrary?: boolean;
};

export type ContextAwareLoggerConfig = {
  memoryLimit?: number;
  flushTimeout?: number;
  outputStrategy?: LogOutputStrategy;
} & SimpleLoggerConfig;

export type LibraryConfig = ContextAwareLoggerConfig;

export const createConfig = (
  cfg: LibraryConfig | undefined = undefined,
  env: Record<string, string | undefined> = process.env,
): Required<LibraryConfig> => {
  return ({
    timezone: cfg?.timezone || env.LOG_TZ || "Australia/Sydney",
    logLevel: LOG_LEVELS.find((it) => it === (cfg?.logLevel || env.LOG_LEVEL || "").toLowerCase()) || "info",
    memoryLimit: cfg?.memoryLimit || parseInt(env.LOG_MEMORY_LIMIT_MB || "1"),
    flushTimeout: cfg?.flushTimeout || parseInt(env.LOG_FLUSH_TIMEOUT_S || "0") || Number.MAX_SAFE_INTEGER,
    jsonIndent: cfg?.jsonIndent || parseInt(env.LOG_JSON_INDENT || "0"),
    outputStrategy:
      LOG_OUTPUT_STRATEGIES.find((it) => it === (cfg?.outputStrategy || env.LOG_OUTPUT_STRATEGY || "").toLowerCase())
      || "instant_after_flush",
    debugLibrary: cfg?.debugLibrary !== undefined ? cfg?.debugLibrary : env.LOG_DEBUG_LIBRARY === "true",
  });
};
