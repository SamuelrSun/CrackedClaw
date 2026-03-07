import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { Integration, IntegrationType, IntegrationStatus } from "@/types/integration";

// In-memory store for demo (would be Supabase in production)
const integrationsStore: Integration[] = [
  {
    id: "google",
    name: "Google Workspace",
    slug: "google-workspace",
    icon: "Mail",
    type: "oauth",
    status: "connected",
    config: { scopes: ["Gmail", "Calendar", "Drive"] },
    accounts: [
      { id: "1", email: "sam@gmail.com", connectedAt: "2 days ago" },
      { id: "2", email: "work@company.com", connectedAt: "1 week ago" },
    ],
    last_sync: "2 min ago",
  },
  {
    id: "slack",
    name: "Slack",
    slug: "slack",
    icon: "MessageSquare",
    type: "oauth",
    status: "connected",
    config: { scopes: ["Messages", "Channels"] },
    accounts: [{ id: "1", email: "sam@openclaw.ai", connectedAt: "3 days ago" }],
    last_sync: "5 min ago",
  },
  {
    id: "notion",
    name: "Notion",
    slug: "notion",
    icon: "FileText",
    type: "oauth",
    status: "disconnected",
    config: {},
    accounts: [],
    last_sync: null,
  },
  {
    id: "github",
    name: "GitHub",
    slug: "github",
    icon: "Github",
    type: "oauth",
    status: "connected",
    config: { scopes: ["Repos", "Issues", "PRs"] },
    accounts: [{ id: "1", email: "samwang@github.com", connectedAt: "2 weeks ago" }],
    last_sync: "10 min ago",
  },
  {
    id: "linear",
    name: "Linear",
    slug: "linear",
    icon: "BarChart3",
    type: "oauth",
    status: "disconnected",
    config: {},
    accounts: [],
    last_sync: null,
  },
  {
    id: "figma",
    name: "Figma",
    slug: "figma",
    icon: "Palette",
    type: "oauth",
    status: "disconnected",
    config: {},
    accounts: [],
    last_sync: null,
  },
];

// GET /api/integrations - List all integrations
export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  return jsonResponse({
    integrations: integrationsStore,
    count: integrationsStore.length,
    userId: user.id,
  });
}

// POST /api/integrations - Create a new integration
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return errorResponse("Name is required", 400);
    }

    const slug = body.slug || body.name.toLowerCase().replace(/\s+/g, "-");
    const type: IntegrationType = body.type || "oauth";
    const status: IntegrationStatus = body.status || "disconnected";

    const newIntegration: Integration = {
      id: body.id || `int_${Date.now()}`,
      name: body.name,
      slug,
      icon: body.icon || "Plug",
      type,
      status,
      config: body.config || {},
      accounts: body.accounts || [],
      last_sync: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    integrationsStore.push(newIntegration);

    return jsonResponse(
      {
        message: "Integration created",
        integration: newIntegration,
      },
      201
    );
  } catch {
    return errorResponse("Invalid request body", 400);
  }
}
