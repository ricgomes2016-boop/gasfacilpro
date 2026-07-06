import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "health_check",
  title: "Health check",
  description: "Verify connectivity to the Gás Fácil MCP server and echo an optional message.",
  inputSchema: {
    message: z.string().optional().describe("Optional message to echo back."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ message }) => ({
    content: [
      {
        type: "text",
        text: `Gás Fácil MCP server OK. ${message ? `Echo: ${message}` : "No message provided."} Time: ${new Date().toISOString()}`,
      },
    ],
  }),
});
