import { defineMcp } from "@lovable.dev/mcp-js";
import healthTool from "./tools/health";

export default defineMcp({
  name: "gasfacil-mcp",
  title: "Gás Fácil MCP",
  version: "0.1.0",
  instructions:
    "MCP server for the Gás Fácil ERP. Use `health_check` to verify connectivity. Additional tools can be added under src/lib/mcp/tools/.",
  tools: [healthTool],
});
