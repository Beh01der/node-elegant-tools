A simple toolset for Node.js / TypeScript AWS lambda development

** Context-aware logging

```typescript
import { EventBridgeEvent } from "aws-lambda";
import { createHandler, getContext } from "elegant-tools";

export const handler = createHandler(async (event: EventBridgeEvent<string, any>) => {
  const { logger } = getContext();
  if (event["detail-type"] !== "supported-event-type") {
    logger.info(`Ignoring event: ${event["detail-type"]}`);
    return;
  }

  const input = SupportedEventSchema.parse(event.detail);
  logger.patchContext({
    correlationId: input.metadata["correlation-id"],
    ...
  });

  return await someDownstreamService(input);
});
```
