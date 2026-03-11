# Mem0 Optimization Plan

_Created: 2026-03-10 by SOPHIA_
_Status: SAVED FOR LATER — not implemented_

## Problem

The current mem0 pipeline is robust but burns tokens unnecessarily:

1. **Per-message Claude extraction** — Every single user message triggers a Claude Sonnet call to extract facts, even for "ok" or "thanks". Doubles API spend.
2. **Over-injection in system prompt** — 15 search + 10 core = 25 memories injected per message (~1,600 tokens).
3. **No temporal decay** — `accessed_at` exists in schema but isn't used for pruning. Memories accumulate forever.
4. **Duplicate embedding calls** — Even when content is identical to an existing memory, we pay for an embedding to discover the duplicate.

## Current Architecture (As-Is)

```
Every chat message:
  ├─ mem0Search(userMessage, limit=15) → semantic search results
  ├─ mem0GetCore(minImportance=0.7, limit=10) → high-importance memories
  ├─ Both injected into system prompt as "MEMORY" section
  │
  ├─ Agent responds
  │
  ├─ processAgentResponse():
  │   ├─ Parse [[REMEMBER:]] markers → mem0Write each one
  │   ├─ Parse [[FORGET:]] markers → semantic search + delete
  │   ├─ Parse [[STORE_SECRET:]] markers → encrypt + store
  │   └─ mem0Add(conversation) → Claude extraction (EXPENSIVE)
  │       ├─ Claude Sonnet extracts facts from [user msg, assistant msg]
  │       ├─ For each fact: getEmbedding() → OpenAI call
  │       ├─ For each fact: match_memories(0.9 threshold) → dedup check
  │       └─ Insert or update memory row
```

### Cost Per Message
- 1x Claude Sonnet call for fact extraction (~500-1000 tokens)
- 1x OpenAI embedding for search query
- Nx OpenAI embeddings for extracted facts
- Nx pgvector similarity queries for dedup
- System prompt overhead: ~1,600 tokens of memory context

### Scale Limits
- IVFFlat index (lists=100): good up to ~100K vectors, then recall degrades
- System prompt: 25 memories x ~50 words = ~1,250 words per request
- Single user heavy usage: ~1-5K memories over months (fine)
- 100+ users sharing table: needs monitoring

## Proposed Architecture (Optimized)

```
Chat message comes in:
  ├─ IF first message of conversation:
  │   ├─ mem0Search(userMessage, limit=10)
  │   └─ mem0GetCore(minImportance=0.7, limit=10)
  │   └─ Inject up to 20 memories
  ├─ IF subsequent message:
  │   └─ mem0Search(userMessage, limit=5)
  │   └─ Inject up to 5 memories (core already in context)
  │
  ├─ Agent responds
  │
  ├─ Parse [[REMEMBER:]] markers → mem0Write (immediate, cheap)
  ├─ Parse [[FORGET:]] / [[STORE_SECRET:]] → handle immediately
  │
  └─ NO per-message Claude extraction

Background (after 10min conversation idle OR conversation ends):
  ├─ One Claude Sonnet call extracts facts from FULL conversation
  ├─ Dedup + store via mem0Add
  └─ Update accessed_at on referenced memories
```

### Changes Required

#### 1. Remove per-message extraction (biggest savings)

In `src/lib/memory/service.ts` → `processAgentResponse()`:
- Remove the `mem0Add()` call at the bottom (the background auto-extract)
- Keep the marker parsing (REMEMBER/FORGET/SECRET) — those are free regex operations

#### 2. Add batch extraction on conversation end

New function in `src/lib/memory/service.ts`:
```typescript
export async function extractConversationMemories(
  userId: string,
  conversationId: string
): Promise<void> {
  // Load full conversation
  const messages = await getConversationMessages(conversationId);
  if (messages.length < 2) return;

  // Single Claude call for entire conversation
  await mem0Add(messages, userId);
}
```

Trigger options:
- API endpoint called by frontend when user navigates away
- Cron job that finds conversations idle >10 min
- Webhook on conversation close

#### 3. Smarter system prompt injection

In `src/lib/gateway/system-prompt.ts` → `buildSystemPromptForUser()`:
```typescript
// Add isFirstMessage parameter
const isFirstMessage = !previousMessages || previousMessages.length === 0;

const [searchResults, coreResults] = await Promise.all([
  userMessage ? mem0Search(userMessage, userId, {
    limit: isFirstMessage ? 10 : 5,
    threshold: 0.4
  }) : Promise.resolve([]),
  isFirstMessage ? mem0GetCore(userId, { minImportance: 0.7, limit: 10 }) : Promise.resolve([]),
]);
```

#### 4. Temporal decay via accessed_at

Add to `mem0Search` — update `accessed_at` when memories are recalled:
```typescript
// After search returns results, update accessed_at for returned memories
if (data && data.length > 0) {
  const ids = data.map(m => m.id);
  await supabase.from('memories')
    .update({ accessed_at: new Date().toISOString() })
    .in('id', ids);
}
```

Add cleanup (cron or heartbeat):
```typescript
// Archive stale memories: not accessed in 90 days AND low importance
await supabase.from('memories')
  .update({ status: 'archived' })
  .lt('accessed_at', ninetyDaysAgo.toISOString())
  .lt('importance', 0.5)
  .eq('user_id', userId);
```

Requires schema change:
```sql
ALTER TABLE memories ADD COLUMN status text DEFAULT 'active';
CREATE INDEX memories_status_idx ON memories (user_id, status);
-- Update match_memories to filter: AND (m.status IS NULL OR m.status = 'active')
```

#### 5. Skip embedding for identical content

In `mem0Write`, before calling `getEmbedding()`:
```typescript
// Fast text match — skip embedding if exact content already exists
const { data: exact } = await supabase
  .from('memories')
  .select('id')
  .eq('user_id', userId)
  .eq('content', content)
  .limit(1);

if (exact && exact.length > 0) {
  // Just update timestamps, skip embedding
  await supabase.from('memories').update({
    accessed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', exact[0].id);
  return exact[0].id;
}
```

## Expected Impact

| Metric | Current | Optimized |
|--------|---------|-----------|
| Claude calls per message | 1 (extraction) | 0 |
| Claude calls per conversation | N (one per msg) | 1 (batch at end) |
| System prompt memory tokens | ~1,600 | ~600-1,000 |
| Memory API cost reduction | baseline | ~80% |
| Recall quality | same | same (possibly better with decay) |

## Files to Modify

1. `src/lib/memory/service.ts` — remove per-msg extraction, add batch function
2. `src/lib/memory/mem0-client.ts` — add accessed_at updates on search, exact-match shortcut
3. `src/lib/gateway/system-prompt.ts` — first-msg vs subsequent-msg injection logic
4. `supabase/migrations/` — add status column + index
5. New: conversation idle detection (cron or frontend trigger)

## Notes

- The [[REMEMBER:]] marker system stays — it's free (regex) and gives the agent explicit control
- The domain classifier stays — it's a simple regex, no API calls
- The integration scanner (scanGoogleData) stays — it runs on-demand, not per-message
- pgvector + dedup at 0.9 stays — the core storage is solid
- The memory_add tool the agent can call explicitly stays — agent-driven memory is good
- Only the AUTOMATIC per-message extraction is removed (the expensive part)
