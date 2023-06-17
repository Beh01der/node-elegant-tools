import { createHandler } from "./lambda";

describe("lambda", () => {
  it("should work", async () => {
    const handler = createHandler(async (event, context) => (`${event}+${context}`));
    const result = await handler("event", "context");

    expect(result).toEqual("event+context");
  });

  it("should handle / log error", async () => {
    const handler = createHandler(async () => {
      throw new Error("Oh no!");
    });

    expect(handler("event", "context")).rejects.toThrow("Oh no!");
  });
});
