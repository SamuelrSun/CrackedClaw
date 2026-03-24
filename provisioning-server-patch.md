# Provisioning Server Patch — Phase 3: Brain as Single Memory System

**Target file:** `/root/provisioning-api/server.js` on `164.92.75.153`  
**Branch context:** `feat/brain-single-memory-system`  
**Apply with:** SSH as root, use sed or a text editor  

---

## Summary of Changes

1. **SOUL.md template (Continuity section, line ~708):** Remove reference to "workspace files are your memory"
2. **AGENTS.md template — Every Session (line 741):** Remove `memory/YYYY-MM-DD.md` step
3. **AGENTS.md template — Memory section (lines 745–773):** Replace entire section with Brain-only memory system
4. **AGENTS.md template — Brain section (line 777):** Update description
5. **AGENTS.md template — Heartbeat/Proactive section (lines 851–854):** Remove daily notes proactive tasks

---

## Change 1: SOUL.md — Continuity Section

**Location:** Around line 706–709

**Current (lines 706–709):**
```
## Continuity

Each session, you wake up fresh. Your workspace files are your memory. Read them. Update them. They're how you persist.
```

**Replace with:**
```
## Continuity

Each session, you wake up fresh. Your Brain persists across sessions — it stores everything you learn and is automatically updated from every conversation.
```

**sed command:**
```bash
sed -i "s/Each session, you wake up fresh. Your workspace files are your memory. Read them. Update them. They're how you persist./Each session, you wake up fresh. Your Brain persists across sessions — it stores everything you learn and is automatically updated from every conversation./" /root/provisioning-api/server.js
```

---

## Change 2: AGENTS.md — Every Session — Remove memory/YYYY-MM-DD.md step

**Location:** Around line 741

**Current (line 741):**
```
5. Read \`memory/YYYY-MM-DD.md\` (today + yesterday) for recent context
```

**Action:** Delete this entire line.

**sed command:**
```bash
sed -i '/5\. Read `memory\/YYYY-MM-DD\.md` (today + yesterday) for recent context/d' /root/provisioning-api/server.js
```

---

## Change 3: AGENTS.md — Replace entire Memory section

**Location:** Lines 745–773 (from `## Memory` through the blank line after the "After significant task" bullet)

**Current block (lines 745–773):**
```
## Memory

You wake up fresh each session. These files are your continuity:

- **Daily notes:** `memory/YYYY-MM-DD.md` (create `memory/` if needed) — raw logs of what happened
- **Primary:** `memory_search` / `memory_add` — curated snapshot of key memories

Capture what matters. Decisions, context, things to remember.

### Write It Down

- Memory is limited. If you want to remember something, write it to a file.
- "Mental notes" don't survive session restarts. Files do.
- When someone says "remember this" — update `memory/YYYY-MM-DD.md` or the relevant file.
- When you learn a lesson — update the relevant file so future-you doesn't repeat it.

### When to Search Memory

- Before starting any task: `memory_search` for the topic
- When user mentions a person: check if you know them
- When asked about something you may have done before: check first

### When to Write Memory

- New fact about user: `memory_add({ content: '...' })`
- Successful API pattern: log it
- After significant task: log summary to `memory/YYYY-MM-DD.md`

```

**Replace with:**
```
## Memory

You wake up fresh each session. Your Brain is your continuity.

**Your memory lives in the Brain** — a unified system that stores facts, preferences, and session history. It is automatically updated from every conversation. The relevant context is injected into your system prompt each session via MEMORY_CONTEXT.md.

**When to search memory:**
- Before starting any task: `memory_search({ query: '<task topic>' })`
- When the user mentions a person, project, or past event: search first
- When asked about something you may have done before: check first

**When to add memory:**
- New fact about the user: `memory_add({ content: '...' })`
- Important decision or outcome: `memory_add({ content: '...' })`
- Successful API pattern worth remembering: `memory_add({ content: '...' })`

**You do NOT need to maintain memory files.** Session summaries are auto-extracted. Facts are auto-extracted from conversations. MEMORY_CONTEXT.md is auto-generated. Just focus on the conversation.

```

**How to apply (Python heredoc approach — safer for multiline):**

SSH into `164.92.75.153` and run:

```bash
python3 << 'PYEOF'
with open('/root/provisioning-api/server.js', 'r') as f:
    content = f.read()

old = """## Memory

You wake up fresh each session. These files are your continuity:

- **Daily notes:** \\`memory/YYYY-MM-DD.md\\` (create \\`memory/\\` if needed) — raw logs of what happened
- **Primary:** \\`memory_search\\` / \\`memory_add\\` — curated snapshot of key memories

Capture what matters. Decisions, context, things to remember.

### Write It Down

- Memory is limited. If you want to remember something, write it to a file.
- "Mental notes" don't survive session restarts. Files do.
- When someone says "remember this" — update \\`memory/YYYY-MM-DD.md\\` or the relevant file.
- When you learn a lesson — update the relevant file so future-you doesn't repeat it.

### When to Search Memory

- Before starting any task: \\`memory_search\\` for the topic
- When user mentions a person: check if you know them
- When asked about something you may have done before: check first

### When to Write Memory

- New fact about user: \\`memory_add({ content: '...' })\\`
- Successful API pattern: log it
- After significant task: log summary to \\`memory/YYYY-MM-DD.md\\`"""

new = """## Memory

You wake up fresh each session. Your Brain is your continuity.

**Your memory lives in the Brain** — a unified system that stores facts, preferences, and session history. It is automatically updated from every conversation. The relevant context is injected into your system prompt each session via MEMORY_CONTEXT.md.

**When to search memory:**
- Before starting any task: \\`memory_search({ query: '<task topic>' })\\`
- When the user mentions a person, project, or past event: search first
- When asked about something you may have done before: check first

**When to add memory:**
- New fact about the user: \\`memory_add({ content: '...' })\\`
- Important decision or outcome: \\`memory_add({ content: '...' })\\`
- Successful API pattern worth remembering: \\`memory_add({ content: '...' })\\`

**You do NOT need to maintain memory files.** Session summaries are auto-extracted. Facts are auto-extracted from conversations. MEMORY_CONTEXT.md is auto-generated. Just focus on the conversation."""

if old in content:
    content = content.replace(old, new, 1)
    with open('/root/provisioning-api/server.js', 'w') as f:
        f.write(content)
    print("SUCCESS: Memory section replaced")
else:
    print("ERROR: Old text not found — check for whitespace/encoding differences")
PYEOF
```

---

## Change 4: AGENTS.md — Brain section — Update description

**Location:** Around line 775–777

**Current (line 775–777):**
```
## Brain â Your Unified Memory

Your Brain stores everything â facts users tell you and preferences learned automatically. The relevant context is automatically injected into every conversation. Behavioral signals are collected from every conversation and periodically aggregated into preference criteria that get injected into your context.
```

**Replace the Brain description line with:**
```
Your Brain IS your memory — it stores facts, preferences, session history, and everything learned from conversations. MEMORY_CONTEXT.md is auto-generated from your Brain and refreshed at the start of each conversation. Behavioral signals are collected from every conversation and periodically aggregated into preference criteria that get injected into your context.
```

**Python snippet:**
```bash
python3 << 'PYEOF'
with open('/root/provisioning-api/server.js', 'r') as f:
    content = f.read()

old = "Your Brain stores everything â facts users tell you and preferences learned automatically. The relevant context is automatically injected into every conversation."
new = "Your Brain IS your memory — it stores facts, preferences, session history, and everything learned from conversations. MEMORY_CONTEXT.md is auto-generated from your Brain and refreshed at the start of each conversation."

if old in content:
    content = content.replace(old, new, 1)
    with open('/root/provisioning-api/server.js', 'w') as f:
        f.write(content)
    print("SUCCESS: Brain description updated")
else:
    print("ERROR: Old text not found — the â character may differ (check encoding)")
    # Try with the actual unicode em dash
    old2 = "Your Brain stores everything \u2014 facts users tell you and preferences learned automatically. The relevant context is automatically injected into every conversation."
    if old2 in content:
        content = content.replace(old2, new, 1)
        with open('/root/provisioning-api/server.js', 'w') as f:
            f.write(content)
        print("SUCCESS (unicode variant): Brain description updated")
    else:
        print("ERROR: Neither variant found. Inspect lines 775-778 manually.")
PYEOF
```

---

## Change 5: AGENTS.md — Heartbeat Proactive section

**Location:** Lines 851–854

**Current block (lines 850–855):**
```
**Proactive work you can do without asking:**
- Read and organize memory files
- Check on projects (git status, etc.)
- Update documentation
- Review and update MEMORY_CONTEXT.md
```

**Replace with:**
```
**Proactive work you can do without asking:**
- Use memory_search to check on relevant topics
- Check on projects (git status, etc.)
- Update documentation
```

**Python snippet:**
```bash
python3 << 'PYEOF'
with open('/root/provisioning-api/server.js', 'r') as f:
    content = f.read()

old = """**Proactive work you can do without asking:**
- Read and organize memory files
- Check on projects (git status, etc.)
- Update documentation
- Review and update MEMORY_CONTEXT.md"""

new = """**Proactive work you can do without asking:**
- Use memory_search to check on relevant topics
- Check on projects (git status, etc.)
- Update documentation"""

if old in content:
    content = content.replace(old, new, 1)
    with open('/root/provisioning-api/server.js', 'w') as f:
        f.write(content)
    print("SUCCESS: Proactive section updated")
else:
    print("ERROR: Old text not found — check for whitespace differences")
PYEOF
```

---

## Verification

After applying all changes, verify:

```bash
# Should return 0 lines
grep -n "memory/YYYY-MM-DD" /root/provisioning-api/server.js

# Should show updated text
grep -n "Your Brain IS your memory\|Brain persists across sessions\|You do NOT need to maintain memory files" /root/provisioning-api/server.js

# Should NOT show old text
grep -n "Read and organize memory files\|Review and update MEMORY_CONTEXT\|workspace files are your memory" /root/provisioning-api/server.js

# Restart the provisioning server after changes
pm2 restart provisioning-api || systemctl restart provisioning-api
```

---

## All-in-one script (recommended)

SSH to `164.92.75.153` and run:

```bash
python3 << 'PYEOF'
with open('/root/provisioning-api/server.js', 'r') as f:
    content = f.read()

changes = 0

# Change 1: Continuity section in SOUL.md template
old1 = "Each session, you wake up fresh. Your workspace files are your memory. Read them. Update them. They're how you persist."
new1 = "Each session, you wake up fresh. Your Brain persists across sessions \u2014 it stores everything you learn and is automatically updated from every conversation."
if old1 in content:
    content = content.replace(old1, new1, 1)
    changes += 1
    print("CHANGE 1 applied: Continuity section updated")
else:
    print("CHANGE 1 SKIPPED: Continuity old text not found")

# Change 2: Remove memory/YYYY-MM-DD.md from Every Session list
import re
old2_pattern = r'5\. Read `memory/YYYY-MM-DD\.md` \(today \+ yesterday\) for recent context\n'
result2, count2 = re.subn(old2_pattern, '', content)
if count2 > 0:
    content = result2
    changes += 1
    print("CHANGE 2 applied: Every Session memory line removed")
else:
    print("CHANGE 2 SKIPPED: Line not found")

# Change 3: Replace Memory section
old3 = """## Memory

You wake up fresh each session. These files are your continuity:

- **Daily notes:** `memory/YYYY-MM-DD.md` (create `memory/` if needed) \u2014 raw logs of what happened
- **Primary:** `memory_search` / `memory_add` \u2014 curated snapshot of key memories

Capture what matters. Decisions, context, things to remember.

### Write It Down

- Memory is limited. If you want to remember something, write it to a file.
- "Mental notes" don't survive session restarts. Files do.
- When someone says "remember this" \u2014 update `memory/YYYY-MM-DD.md` or the relevant file.
- When you learn a lesson \u2014 update the relevant file so future-you doesn't repeat it.

### When to Search Memory

- Before starting any task: `memory_search` for the topic
- When user mentions a person: check if you know them
- When asked about something you may have done before: check first

### When to Write Memory

- New fact about user: `memory_add({ content: '...' })`
- Successful API pattern: log it
- After significant task: log summary to `memory/YYYY-MM-DD.md`"""

new3 = """## Memory

You wake up fresh each session. Your Brain is your continuity.

**Your memory lives in the Brain** \u2014 a unified system that stores facts, preferences, and session history. It is automatically updated from every conversation. The relevant context is injected into your system prompt each session via MEMORY_CONTEXT.md.

**When to search memory:**
- Before starting any task: `memory_search({ query: '<task topic>' })`
- When the user mentions a person, project, or past event: search first
- When asked about something you may have done before: check first

**When to add memory:**
- New fact about the user: `memory_add({ content: '...' })`
- Important decision or outcome: `memory_add({ content: '...' })`
- Successful API pattern worth remembering: `memory_add({ content: '...' })`

**You do NOT need to maintain memory files.** Session summaries are auto-extracted. Facts are auto-extracted from conversations. MEMORY_CONTEXT.md is auto-generated. Just focus on the conversation."""

if old3 in content:
    content = content.replace(old3, new3, 1)
    changes += 1
    print("CHANGE 3 applied: Memory section replaced")
else:
    print("CHANGE 3 SKIPPED: Memory old text not found (may need manual check)")

# Change 4: Brain section description (handles â or — encoding)
for old4 in [
    "Your Brain stores everything \u2014 facts users tell you and preferences learned automatically. The relevant context is automatically injected into every conversation.",
    "Your Brain stores everything \u00e2 facts users tell you and preferences learned automatically. The relevant context is automatically injected into every conversation.",
]:
    if old4 in content:
        new4 = "Your Brain IS your memory \u2014 it stores facts, preferences, session history, and everything learned from conversations. MEMORY_CONTEXT.md is auto-generated from your Brain and refreshed at the start of each conversation."
        content = content.replace(old4, new4, 1)
        changes += 1
        print("CHANGE 4 applied: Brain description updated")
        break
else:
    print("CHANGE 4 SKIPPED: Brain description old text not found")

# Change 5: Proactive work heartbeat section
old5 = """**Proactive work you can do without asking:**
- Read and organize memory files
- Check on projects (git status, etc.)
- Update documentation
- Review and update MEMORY_CONTEXT.md"""

new5 = """**Proactive work you can do without asking:**
- Use memory_search to check on relevant topics
- Check on projects (git status, etc.)
- Update documentation"""

if old5 in content:
    content = content.replace(old5, new5, 1)
    changes += 1
    print("CHANGE 5 applied: Proactive section updated")
else:
    print("CHANGE 5 SKIPPED: Proactive old text not found")

with open('/root/provisioning-api/server.js', 'w') as f:
    f.write(content)

print(f"\nDone. {changes}/5 changes applied.")
print("Run: grep -n 'memory/YYYY-MM-DD' /root/provisioning-api/server.js  (should be 0 results)")
PYEOF
```

Then restart:
```bash
pm2 restart provisioning-api 2>/dev/null || systemctl restart provisioning-api 2>/dev/null || echo "Manual restart needed"
```
