import { AsyncLocalStorage } from "async_hooks";
import { ContextAwareLogger } from "./logger";

type CallContext = {
  logger: ContextAwareLogger;
};

const asyncLocalStorage = new AsyncLocalStorage<CallContext>();

export const withContext = async <T>(wrapped: () => T) => {
  const context = { logger: new ContextAwareLogger() };

  try {
    return await asyncLocalStorage.run(context, wrapped);
  } catch (error: any) {
    context.logger.error("Unexpected error", { error: error.toString() || error.message || error });
    if (error.stack) {
      context.logger.error("stack", { stack: error.stack });
    }
    throw error;
  } finally {
    context.logger.flush();
  }
};

const defaultLogger = new ContextAwareLogger();
export const getContext = () => {
  const context = asyncLocalStorage.getStore();
  return context || { logger: defaultLogger };
};
