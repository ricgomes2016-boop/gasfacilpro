const API_BASE_URL = "https://api.gasfacilpro.com.br";

interface IntegrationPayload {
  company_id: string;
  integration_name: string;
  settings: Record<string, unknown>;
}

interface IntegrationResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Saves integration settings to the external API.
 * Fails silently — returns success:false if unreachable.
 */
export async function saveIntegrationSettings(
  data: IntegrationPayload,
  token?: string
): Promise<IntegrationResponse> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/integrations/save`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.warn(`[integrationsApi] saveIntegrationSettings failed: ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();
    return { success: true, data: result };
  } catch (err: unknown) {
    console.warn("[integrationsApi] saveIntegrationSettings error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/**
 * Fetches integration settings from the external API.
 * Returns null if API is unreachable — page continues working normally.
 */
export async function getIntegrationSettings(
  companyId: string,
  token?: string
): Promise<Record<string, unknown> | null> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/integrations/${companyId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      console.warn(`[integrationsApi] getIntegrationSettings failed: ${response.status}`);
      return null;
    }

    const result = await response.json();
    return result;
  } catch (err: unknown) {
    console.warn("[integrationsApi] getIntegrationSettings error:", err);
    return null;
  }
}
