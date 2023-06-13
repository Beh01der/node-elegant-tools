import { createHandler } from "./lambda";

describe("lambda", () => {
  it("should work", async () => {
    const handler = createHandler(async (event, context) => (`${event}+${context}`));
    const result = await handler("event", "context");

    expect(result).toEqual("event+context");
  });
});
