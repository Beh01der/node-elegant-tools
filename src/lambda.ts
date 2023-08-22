import { v4 as uuidv4 } from "uuid";
import { getContext, withContext } from "./context";
import { readJsonFile } from "./misc";

const { name, version } = readJsonFile("package.json") || {};

export const createHandler =
  (handler: (event?: any, context?: any) => Promise<any>) => async (event?: any, context?: any) =>
    withContext(async () => {
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
    });
