import { auth, defineMcp } from "@lovable.dev/mcp-js";
import healthTool from "./tools/health";

// OAuth issuer must be the direct Supabase host (see app-mcp-server-authoring).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "gasfacil-mcp",
  title: "Gás Fácil MCP",
  version: "0.1.0",
  instructions:
    "MCP server for the Gás Fácil ERP. Use `health_check` to verify connectivity. Additional tools can be added under src/lib/mcp/tools/.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [healthTool],
});
