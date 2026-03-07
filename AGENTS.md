# AGENTS.md — OpenClaw Cloud

## What This Project Is
A web dashboard for OpenClaw-as-a-Service. Users manage their hosted or self-hosted OpenClaw instance through this interface.

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS with custom design tokens
- **Database:** Supabase (PostgreSQL + Auth)
- **State:** React hooks, server components where possible

## Design System
See `DESIGN_SYSTEM.md` for full details. Quick reference:

| Token | Value | Usage |
|-------|-------|-------|
| Paper | #F7F7F5 | Background |
| Forest | #1A3C2B | Primary, text |
| Grid | #3A3A38 | Borders, muted text |
| Coral | #FF8C69 | Accent, errors |
| Mint | #9EFFBF | Success, active states |
| Gold | #F4D35E | Warnings, highlights |

**Typography:**
- Headers: Space Grotesk (bold, tight tracking)
- Body: System sans-serif
- Labels/Code: JetBrains Mono (10px, uppercase, wide tracking)

**Rules:**
- No box shadows
- Border radius: 0px or 2px max
- 1px hairline borders at 20% opacity
- Use empty states, not demo data

## Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── gateway/       # Gateway proxy endpoints
│   │   ├── integrations/  # Integration CRUD
│   │   ├── memory/        # Memory CRUD
│   │   └── workflows/     # Workflow CRUD
│   ├── auth/              # Auth callback
│   ├── chat/              # Chat interface
│   ├── commands/          # Workflow commands
│   ├── integrations/      # Integration management
│   ├── memory/            # Memory/knowledge base
│   ├── settings/          # User settings + gateway connection
│   └── login/             # Authentication
├── components/
│   ├── ui/                # Base components (Button, Card, Input, Badge, EmptyState)
│   ├── layout/            # Header, Sidebar, Nav
│   ├── empty-states/      # Specific empty state components
│   └── auth/              # Auth-related components
├── hooks/                 # React hooks (useUser, useGateway)
├── lib/
│   ├── supabase/          # Supabase clients and data fetchers
│   ├── gateway-client.ts  # OpenClaw gateway API client
│   └── utils.ts           # Utility functions
└── types/                 # TypeScript type definitions
```

## Database Schema (Supabase)

### Core Tables
| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (extends auth.users) |
| `user_gateways` | Connected OpenClaw instances |
| `integrations` | Connected services (Google, Slack, etc.) |
| `conversations` | Chat conversation threads |
| `messages` | Individual chat messages |
| `memory_entries` | Agent memory/knowledge |
| `instructions` | Agent behavior instructions |
| `workflows` | Automation workflows |
| `workflow_runs` | Workflow execution history |
| `activity_log` | User activity tracking |
| `token_usage` | API token usage tracking |
| `team_members` | Team/org membership |

### Key Relationships
- All user data tables reference `auth.users(id)` via `user_id`
- `messages` reference `conversations(id)`
- `workflow_runs` reference `workflows(id)`
- RLS enabled on all tables (users can only access own data)

## Gateway Integration

### How Gateway Connection Works
1. User enters gateway URL + auth token in Settings
2. Backend tests connection via `/v1/chat/completions`
3. On success, saves to `user_gateways` table
4. All chat/status/memory requests proxy through the gateway

### Gateway Endpoints Used
| Endpoint | Purpose |
|----------|---------|
| `/v1/chat/completions` | OpenAI-compatible chat |
| `/api/status` | Agent status (name, model, uptime) |
| `/api/integrations` | List connected integrations |
| `/api/config` | Full config (fallback for integrations) |

### Gateway Client (`src/lib/gateway-client.ts`)
```typescript
fetchGatewayStatus(url, token)    // Get agent status
fetchGatewayMemory(url, token)    // Get memory entries
fetchGatewayIntegrations(url, token) // Get integrations
sendGatewayMessage(url, token, message) // Send chat message
pingGateway(url, token)           // Test connectivity
```

## Common Patterns

### Data Fetching
```typescript
// Server component (preferred)
export default async function Page() {
  const data = await getData();
  return <ClientComponent initialData={data} />;
}

// Client component with hook
const { data, loading, error } = useData();
```

### Empty States
```typescript
import { NoWorkflows } from '@/components/empty-states';

{workflows.length === 0 ? (
  <NoWorkflows />
) : (
  <WorkflowList workflows={workflows} />
)}
```

### API Routes
```typescript
// src/app/api/example/route.ts
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // ... fetch data
}
```

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx  # Server-side only
```

## Development

### Commands
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Start production server
```

### Testing Changes
1. Make changes
2. Run `npm run build` to catch TypeScript errors
3. Test in browser at http://localhost:3000
4. Check browser console for errors

### Adding a New Feature
1. Create types in `src/types/`
2. Add Supabase table if needed (migrations in `supabase/migrations/`)
3. Add data fetchers in `src/lib/supabase/data.ts`
4. Create API routes in `src/app/api/`
5. Build UI components
6. Add empty states for zero-data scenarios

## Gotchas

### Dynamic Routes
Pages using `cookies()` must be dynamic. Add:
```typescript
export const dynamic = 'force-dynamic';
```

### Supabase Auth
Always check user authentication in API routes:
```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) return unauthorized();
```

### Template Literals in Code
When writing code that includes template literals, use proper backticks:
```typescript
// ✅ Correct
const id = `prefix_${Date.now()}`;

// ❌ Wrong (escaped)
const id = \`prefix_\${Date.now()}\`;
```

## Future Considerations
- Rate limiting for API routes
- Caching strategy for gateway requests
- WebSocket for real-time updates
- Multi-tenant (org) support expansion
