# Maton OAuth Piping — Build Plan

## Status Tracker
- [x] Phase 1: Verify API key storage (per-user in Supabase profiles.instance_settings)
- [x] Phase 2: Connection creation endpoint (/api/integrations/maton/connect)
- [x] Phase 3: Connection status polling endpoint (/api/integrations/maton/status)
- [x] Phase 4: Update frontend addAccount() flow — full Maton OAuth popup + polling
- [x] Phase 5: Store Maton connection via create-dynamic (metadata.matonConnectionId)
- [x] Phase 6: Maton API proxy utility (maton-proxy.ts + helpers)
- [x] Phase 7: Connection listing (/api/integrations/maton/connections)
- [x] Bonus: API key save/verify/remove endpoint (/api/integrations/maton)
- [x] Bonus: Updated configured-providers to check per-user key
- [x] Bonus: Wired up Maton key input on integrations page (was static, now functional)

## Key Info
- Maton API key: PER USER, stored in Supabase profiles
- Support multiple connections per app
- ctrl.maton.ai = connection management
- gateway.maton.ai = API proxy
- Auth: `Authorization: Bearer {MATON_API_KEY}`

## File List
```
New:
  src/app/api/integrations/maton/connect/route.ts    — create connection
  src/app/api/integrations/maton/status/route.ts     — poll connection status  
  src/app/api/integrations/maton/connections/route.ts — list connections
  src/lib/integrations/maton-proxy.ts                — API proxy utility

Modified:
  src/app/(app)/integrations/client.tsx              — addAccount() Maton branch
  src/lib/integrations/maton-services.ts             — already exists
```

## Maton API Reference
- Create connection: `POST https://ctrl.maton.ai/connections` body: `{ app: "slack" }`
- Get connection: `GET https://ctrl.maton.ai/connections/{connection_id}`
- List connections: `GET https://ctrl.maton.ai/connections?app=slack&status=ACTIVE`
- Delete connection: `DELETE https://ctrl.maton.ai/connections/{connection_id}`
- API proxy: `https://gateway.maton.ai/{app}/{native-api-path}`
- Multi-connection header: `Maton-Connection: {connection_id}`

## Integration Accounts
- Need maton_connection_id column (or store in config JSON)
- api_provider = 'maton'
- app_name = maton app slug

## Flow
User clicks Connect → POST /api/integrations/maton/connect → ctrl.maton.ai/connections 
→ returns oauthUrl → open popup → user does OAuth → poll status → ACTIVE 
→ store connection_id → done
