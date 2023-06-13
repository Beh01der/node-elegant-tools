import { getContext, withContext } from "./context";
import { readJsonFile } from "./misc";

const { name, version } = readJsonFile("package.json") || {};

export const createHandler = (handler: (event: any, context: any) => any) => async (event: any, context: any) =>
  withContext(async () => {
    const { logger } = getContext();

    logger.info(`Running ${name || "unknown"} (${version || "unknown"}) for event`, { event, context });

    try {
      const result = handler(event, context);
      logger.info("Successfully processed event", { result });
      return result;
    } catch (error) {
      logger.error("Failed to process event", { error });
      throw error;
    }
  });
