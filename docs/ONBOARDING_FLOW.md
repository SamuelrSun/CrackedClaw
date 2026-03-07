# OpenClaw Cloud Onboarding Flow

This document describes the complete user journey through the onboarding process.

## Overview

The onboarding flow guides new users through setting up their OpenClaw instance, connecting integrations, and discovering useful workflows.

## User Journey

### 1. Sign Up & Account Creation

**Trigger:** User submits sign-up form

**Steps:**
1. User enters email/password
2. Account created in Supabase Auth
3. Profile record auto-created via trigger

**Outcome:** User has an account but no OpenClaw instance yet

---

### 2. Instance Provisioning

**Trigger:** User clicks "Create My Agent" on onboarding page

**Steps:**
1. `POST /api/organizations/provision` called
2. Organization record created
3. OpenClaw instance provisioned in cloud
4. `onboarding_state` record created with phase="welcome"
5. Welcome conversation created with initial message:
   > "👋 Welcome! I'm your new AI assistant. Let's get to know each other. What should I call you?"

**Outcome:** User has a running OpenClaw instance and is redirected to `/chat`

---

### 3. Welcome Phase (Chat-Based)

**Goal:** Establish rapport, learn user's name, let them name the agent

**Chat Flow:**

```
Agent: 👋 Welcome! I'm your new AI assistant. Let's get to know each other. 
       What should I call you?

User: I'm Alex

Agent: Great to meet you, Alex! One more thing – what would you like to call me? 
       I'm your AI assistant, so pick a name that feels right.

User: How about Scout?

Agent: [[welcome:Alex,Scout]]
       Perfect! I'm Scout, nice to officially meet you Alex! 
       Now, tell me a bit about what you do...
```

**State Updates:**
- `user_display_name` → "Alex"
- `agent_name` → "Scout"
- `completed_steps` → ["user_name_provided", "agent_name_provided"]

**On Completion:** 
- Welcome animation plays
- Phase transitions to "integrations"

---

### 4. Integrations Phase (Chat-Based)

**Goal:** Connect relevant tools based on user's needs

**Chat Flow:**

```
Agent: Based on what you do, I can help you more if I'm connected to your tools.
       
       [[integration:google]]
       
       [[integration:slack]]
       
       Connect what you'd like, or say "skip" to move on!

User: [Clicks "Connect Google"]
       → OAuth popup opens
       → User authorizes
       → Popup closes with success message

Agent: [[integration-status:google:connected:alex@company.com]]
       
       Google's connected! Want to add any others, or shall we move on?

User: That's enough for now

Agent: Perfect! With Google connected, I can now help you with email and calendar...
```

**State Updates:**
- `completed_steps` += ["integration_google"]
- Phase can advance when user indicates they're done

**On Completion:** Phase transitions to "context_gathering"

---

### 5. Context Gathering Phase (Optional)

**Goal:** Scan integrations to learn about user's work patterns

**Chat Flow:**

```
Agent: I can take 2 minutes to scan your recent emails and calendar to understand 
       your work better. Want me to do that?

User: Sure

Agent: [[subagent:progress:{"status":"scanning","source":"email","progress":0}]]
       
       Great! I'm scanning now... This will just take a moment.
       
       [[subagent:progress:{"status":"scanning","source":"email","progress":50}]]
       
       [[subagent:progress:{"status":"complete","source":"email","progress":100}]]
       
       [[context:summary:{"insights":[{"icon":"📧","text":"42 emails in past week"},
         {"icon":"👥","text":"Frequent contacts: Product team, Sales"},
         {"icon":"📅","text":"Average 4 meetings/day"}],"source":"email"}]]
       
       Here's what I found! You seem to have a busy schedule with lots of team communication...
```

**State Updates:**
- `completed_steps` += ["context_scan_started", "context_scan_completed"]
- `gathered_context` updated with findings

**On Completion:** Phase transitions to "workflow_setup"

---

### 6. Workflow Setup Phase

**Goal:** Suggest and create first automations

**Chat Flow:**

```
Agent: Based on what I learned, here are some things I could automate:
       
       [[workflow:suggest:{"suggestions":[
         {"id":"email-digest","title":"Daily Email Summary","description":"Morning digest of important emails"},
         {"id":"meeting-prep","title":"Meeting Prep","description":"Context 15 min before meetings"}
       ]}]]
       
       Which of these would be most helpful?

User: [Clicks "Daily Email Summary"]

Agent: Great choice! I'll send you a summary every morning at 9 AM. 
       You're all set!
       
       [[action:complete_onboarding]]
```

**State Updates:**
- `completed_steps` += ["workflow_suggested", "workflow_created"]
- Phase → "complete"

---

### 7. Post-Onboarding

**Changes:**
- `profiles.onboarding_completed` = true
- `profiles.onboarding_completed_at` = now()
- `onboarding_state.phase` = "complete"

**User Experience:**
- Chat continues normally without onboarding prompts
- Welcome conversation remains in history
- Agent uses the name they were given
- Dashboard shows normal view

---

## Phase Transitions

```
welcome → integrations → context_gathering → workflow_setup → complete
    ↓          ↓                ↓                  ↓
    └──────────└────────────────└──────────────────└── (skip/derail)
```

Users can skip at any phase. Skipping advances to the next phase (or complete if on workflow_setup).

---

## Rich Components

The chat renders special syntax as interactive components:

| Syntax | Component | Purpose |
|--------|-----------|---------|
| `[[integration:provider]]` | IntegrationConnectCard | OAuth connect button |
| `[[integration-status:provider:status:account]]` | IntegrationStatusCard | Show connection status |
| `[[welcome:userName,agentName]]` | OnboardingWelcomeAnimation | Animated welcome |
| `[[subagent:progress:{json}]]` | SubagentProgressCard | Show scanning progress |
| `[[context:summary:{json}]]` | ContextSummaryCard | Display findings |
| `[[workflow:suggest:{json}]]` | WorkflowSuggestionCard | Workflow options |
| `[[action:complete_onboarding]]` | (triggers completion) | End onboarding |

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/onboarding/state` | GET | Get current onboarding state |
| `/api/onboarding/start` | POST | Initialize onboarding |
| `/api/onboarding/update` | POST | Update state (phase, steps, names, etc.) |
| `/api/onboarding/skip` | POST | Skip current/all phases |
| `/api/onboarding/complete` | POST/GET | Mark complete / check status |
| `/api/gateway/chat` | POST | Send message (uses onboarding prompt) |
| `/api/integrations/oauth/start` | GET/POST | Start OAuth flow |
| `/api/integrations/oauth/callback` | GET | Handle OAuth callback |

---

## Database Tables

- `onboarding_state` - Tracks phase, steps, names, context
- `user_integrations` - Stores OAuth tokens
- `oauth_flows` - CSRF protection for OAuth
- `user_context` - Gleaned context from integrations
- `profiles` - `onboarding_completed`, `onboarding_completed_at`

---

## Manual Steps Required

### Before First User

1. **Run all migrations:**
   ```bash
   cd supabase
   supabase db push
   # Or run SQL files manually in Supabase Dashboard
   ```

2. **Configure OAuth providers:**
   Set in `.env.local`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   SLACK_CLIENT_ID=...
   SLACK_CLIENT_SECRET=...
   NOTION_CLIENT_ID=...
   NOTION_CLIENT_SECRET=...
   ```

3. **Configure provisioning API:**
   Set in `.env.local`:
   ```
   PROVISIONING_API_URL=...
   PROVISIONING_API_KEY=...
   ```

### Migrations to Run

1. `20260306_initial_schema.sql` - Base tables
2. `20260307_organizations.sql` - Organizations
3. `20260307_onboarding_schema.sql` - Onboarding tables
4. `20260307_profiles_onboarding.sql` - Profile columns
5. `20240307_oauth_tables.sql` - OAuth flow tables

---

## Testing the Flow

### Manual Test Steps

1. Create a new user account
2. Click "Create My Agent" on onboarding page
3. Wait for provisioning to complete
4. Should redirect to `/chat` with welcome message
5. Type your name → agent should acknowledge
6. Type agent name → welcome animation should play
7. Integration cards should appear
8. Click "Connect Google" → OAuth popup
9. Complete OAuth → card shows "Connected"
10. Continue through flow or click "Skip onboarding"
11. Verify `profiles.onboarding_completed` = true

### Reset Onboarding for Testing

```sql
-- Delete onboarding state to re-test
DELETE FROM onboarding_state WHERE user_id = 'your-user-id';
UPDATE profiles SET onboarding_completed = false, onboarding_completed_at = null WHERE id = 'your-user-id';
```

---

## Error Handling

- **Gateway not connected:** Chat shows "No Gateway Connected" banner
- **OAuth fails:** Popup shows error, returns to chat
- **Provisioning fails:** Error displayed on onboarding page
- **Phase transition invalid:** API returns 400 error

---

## Future Enhancements

- [ ] Browser automation for integration setup (non-OAuth flows)
- [ ] VNC view for manual integration help
- [ ] Personalized workflow suggestions based on context
- [ ] Onboarding analytics/funnel tracking
- [ ] A/B testing different onboarding flows
