export const config = {
  timezone: process.env.LOG_TZ || "Australia/Sydney",
  logLevel: (process.env.LOG_LEVEL || "info").toLowerCase()!,
  memoryLimit: parseInt(process.env.LOG_MEMORY_LIMIT_MB || "1"),
  flushTimeout: parseInt(process.env.LOG_FLUSH_TIMEOUT_S || "0") || Number.MAX_SAFE_INTEGER,
  jsonIndent: parseInt(process.env.LOG_JSON_INDENT || "0"),
};
