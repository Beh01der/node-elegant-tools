import { v4 as uuidv4 } from "uuid";
import { createConfig, LibraryConfig } from "./config";
import { getContext, withContext } from "./context";
import { ContextAwareLogger } from "./logger";
import { readJsonFile } from "./misc";

const { name, version } = readJsonFile("package.json") || {};

export const createHandler = (handler: (event?: any, context?: any) => Promise<any>, cfg?: LibraryConfig) => {
  const envConfig = createConfig(cfg);

  return async (event?: any, context?: any) => {
    if (context?.getRemainingTimeInMillis) {
      // for AWS Lambda we use min of configured timeout and remaining time but not less than 1 second
      envConfig.flushTimeout = Math.max(
        1,
        Math.min(envConfig.flushTimeout, Math.floor(context.getRemainingTimeInMillis() / 1000) - 1),
      );
    }

    return withContext(async () => {
      const { logger } = getContext();

      logger.info(`Running ${name || "unknown"} (${version || "unknown"})`, { event, context });

      logger.setContext({
        service: name,
        version,
        invocationId: context?.awsRequestId || uuidv4(),
      });

      try {
        const result = await handler(event, context);

        logger.patchContext({ result: "success" });
        logger.info("Successfully processed event", { result });
        return result;
      } catch (error: any) {
        logger.patchContext({ result: "failure" });
        logger.error("Failed to process event", error);
        throw error;
      }
    }, { logger: new ContextAwareLogger(envConfig) });
  };
};
