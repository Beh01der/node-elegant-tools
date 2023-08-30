import { createConfig } from "./config";

describe("createConfig", () => {
  it("should create default config", () => {
    const config = createConfig({}, {});

    expect(config).toEqual({
      "timezone": "Australia/Sydney",
      "logLevel": "info",
      "memoryLimit": 1,
      "flushTimeout": 9007199254740991,
      "jsonIndent": 0,
      "outputStrategy": "instant_after_flush",
      "debugLibrary": false,
    });
  });

  it("should create config from env", () => {
    const config = createConfig({}, {
      LOG_TZ: "America/New_York",
      LOG_LEVEL: "debug",
      LOG_MEMORY_LIMIT_MB: "5",
      LOG_FLUSH_TIMEOUT_S: "10",
      LOG_JSON_INDENT: "3",
      LOG_OUTPUT_STRATEGY: "instant",
      LOG_DEBUG_LIBRARY: "true",
    });

    expect(config).toEqual({
      "timezone": "America/New_York",
      "logLevel": "debug",
      "memoryLimit": 5,
      "flushTimeout": 10,
      "jsonIndent": 3,
      "outputStrategy": "instant",
      "debugLibrary": true,
    });
  });

  it("should create config with override", () => {
    const config = createConfig({
      "timezone": "Asia/Tokyo",
      "logLevel": "warn",
      "memoryLimit": 3,
      "flushTimeout": 30,
      "jsonIndent": 2,
      "outputStrategy": "always_cached",
      "debugLibrary": true,
    }, {
      LOG_TZ: "America/New_York",
      LOG_LEVEL: "debug",
      LOG_MEMORY_LIMIT_MB: "5",
      LOG_FLUSH_TIMEOUT_S: "10",
      LOG_JSON_INDENT: "3",
      LOG_OUTPUT_STRATEGY: "instant",
      LOG_DEBUG_LIBRARY: "true",
    });

    expect(config).toEqual({
      "timezone": "Asia/Tokyo",
      "logLevel": "warn",
      "memoryLimit": 3,
      "flushTimeout": 30,
      "jsonIndent": 2,
      "outputStrategy": "always_cached",
      "debugLibrary": true,
    });
  });
});
