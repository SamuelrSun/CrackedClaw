/**
 * OpenClaw Provisioning API Client
 */

const PROVISIONING_API_URL = process.env.PROVISIONING_API_URL || "http://164.92.75.153:3100";

export interface ProvisionedInstance {
  id: string;
  gateway_url: string;
  auth_token: string;
  port: number;
  status: string;
}

export interface ProvisionResponse {
  success: boolean;
  instance?: ProvisionedInstance;
  error?: string;
}

export interface InstanceStatusResponse {
  success: boolean;
  instance?: {
    id: string;
    status: string;
    gateway_url: string;
    port: number;
  };
  error?: string;
}

export interface InstanceConfig {
  model?: string;
  ai_api_key?: string | null;
  using_default_key?: boolean;
  channels?: Record<string, unknown>;
}

export interface GetConfigResponse {
  success: boolean;
  config?: InstanceConfig;
  error?: string;
}

export interface UpdateConfigResponse {
  success: boolean;
  config?: InstanceConfig;
  error?: string;
}

export function isProvisioningConfigured(): boolean {
  return !!PROVISIONING_API_URL;
}

export interface UserContext {
  user_display_name?: string;
  agent_name?: string;
  use_case?: string;
}

export async function provisionInstance(
  organizationId: string,
  organizationName: string,
  context?: UserContext
): Promise<ProvisionResponse> {
  if (!isProvisioningConfigured()) {
    return { success: false, error: "Provisioning API not configured" };
  }

  try {
    const response = await fetch(`${PROVISIONING_API_URL}/api/provision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organization_id: organizationId,
        organization_name: organizationName,
        ...(context || {}),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Provisioning failed: ${error}` };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Provisioning error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to provision instance",
    };
  }
}

export async function getInstanceStatus(instanceId: string): Promise<InstanceStatusResponse> {
  if (!isProvisioningConfigured()) {
    return { success: false, error: "Provisioning API not configured" };
  }

  try {
    const response = await fetch(`${PROVISIONING_API_URL}/api/instances/${instanceId}/status`);
    
    if (!response.ok) {
      return { success: false, error: `Failed to get status: ${response.statusText}` };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get instance status",
    };
  }
}

export async function getInstanceConfig(instanceId: string): Promise<GetConfigResponse> {
  if (!isProvisioningConfigured()) {
    return { success: false, error: "Provisioning API not configured" };
  }

  try {
    const response = await fetch(`${PROVISIONING_API_URL}/api/instances/${instanceId}/config`);
    
    if (!response.ok) {
      // Return success with defaults on 404 (config endpoint may not exist yet)
      if (response.status === 404) {
        return { 
          success: true, 
          config: { 
            model: "claude-sonnet-4", 
            using_default_key: true 
          } 
        };
      }
      return { success: false, error: `Failed to get config: ${response.statusText}` };
    }

    const data = await response.json();
    return { success: true, config: data.config || data };
  } catch (error) {
    console.error("Get instance config error:", error);
    // Return defaults on error
    return { 
      success: true, 
      config: { 
        model: "claude-sonnet-4", 
        using_default_key: true 
      } 
    };
  }
}

export async function updateInstanceConfig(
  instanceId: string, 
  config: Partial<InstanceConfig>
): Promise<UpdateConfigResponse> {
  if (!isProvisioningConfigured()) {
    return { success: false, error: "Provisioning API not configured" };
  }

  const secret = process.env.PROVISIONING_API_SECRET;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (secret) {
      headers["Authorization"] = `Bearer ${secret}`;
    }

    const response = await fetch(`${PROVISIONING_API_URL}/api/instances/${instanceId}/config`, {
      method: "PUT",
      headers,
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      return { success: false, error: `Failed to update config: ${response.statusText}` };
    }

    const data = await response.json();
    return { success: true, config: data.config || data };
  } catch (error) {
    console.error("Update instance config error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update config",
    };
  }
}

export async function deleteInstance(instanceId: string): Promise<{ success: boolean; error?: string }> {
  if (!isProvisioningConfigured()) {
    return { success: false, error: "Provisioning API not configured" };
  }

  const secret = process.env.PROVISIONING_API_SECRET;

  try {
    const headers: Record<string, string> = {};
    if (secret) {
      headers["Authorization"] = `Bearer ${secret}`;
    }

    const response = await fetch(`${PROVISIONING_API_URL}/api/instances/${instanceId}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok) {
      return { success: false, error: `Failed to delete: ${response.statusText}` };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete instance",
    };
  }
}

export async function startBrowser(instanceId: string): Promise<{ success: boolean; vncUrl?: string; error?: string }> {
  try {
    const response = await fetch(`${PROVISIONING_API_URL}/instances/${instanceId}/browser/start`, {
      method: "POST",
    });
    
    if (!response.ok) {
      return { success: false, error: "Failed to start browser" };
    }
    
    const data = await response.json();
    return { success: true, vncUrl: data.vncUrl };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to start browser" };
  }
}

export async function getBrowserVnc(instanceId: string): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const response = await fetch(`${PROVISIONING_API_URL}/instances/${instanceId}/browser/vnc`);
    
    if (!response.ok) {
      return { success: false, error: "Failed to get VNC URL" };
    }
    
    const data = await response.json();
    return { success: true, url: data.url };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to get VNC URL" };
  }
}
