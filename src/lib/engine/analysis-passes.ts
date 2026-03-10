import Anthropic from '@anthropic-ai/sdk';
import type { IntegrationData, AnalysisPassResult, ExtractedEntity } from './types';

const MODEL = 'claude-sonnet-4-20250514';

async function runPass(
  apiKey: string,
  passName: string,
  prompt: string,
): Promise<{ memories: AnalysisPassResult['memories']; entities: ExtractedEntity[] }> {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Robust parser: try XML tags first, then markdown code blocks, then raw JSON
  function tryParseJson(str: string): any[] {
    try { return JSON.parse(str); } catch { return []; }
  }
  
  function extractJsonArray(text: string, tag: string): any[] {
    // Try XML tag format: <tag>[...]</tag>
    const xmlMatch = text.match(new RegExp('<' + tag + '>([\\s\\S]*?)<\\/' + tag + '>'));
    if (xmlMatch) { const r = tryParseJson(xmlMatch[1].trim()); if (r.length) return r; }
    // Try labeled code block: ```tag\n[...]```
    const labeledMatch = text.match(new RegExp('```' + tag + '\\n([\\s\\S]*?)```'));
    if (labeledMatch) { const r = tryParseJson(labeledMatch[1].trim()); if (r.length) return r; }
    // Try generic code block: ```json\n[...]```
    const jsonBlocks = Array.from(text.matchAll(/```(?:json)?\n([\s\S]*?)```/g));
    for (const block of jsonBlocks) {
      const r = tryParseJson(block[1].trim());
      if (r.length) return r;
    }
    return [];
  }
  
  const memories = extractJsonArray(text, 'memories');
  const entities = extractJsonArray(text, 'entities');
  
  if (memories.length > 0 || entities.length > 0) {
    return { memories, entities };
  }
  
  // Ultimate fallback: treat entire response as a single memory
  return {
    memories: [{ content: text.substring(0, 3000), page_path: passName.replace('pass_', ''), importance: 0.6, temporal: 'permanent' as const }],
    entities: [],
  };
}

// Helper to prepare email corpus for prompts
function prepareSentCorpus(data: IntegrationData, maxEmails: number = 100): string {
  return data.emails.sent.slice(0, maxEmails).map((e, i) =>
    '--- Email ' + (i + 1) + ' ---\nTo: ' + e.to + '\nSubject: ' + e.subject + '\nDate: ' + e.date + '\nLabels: ' + e.labels.join(', ') + '\nBody:\n' + e.body.substring(0, 1500)
  ).join('\n\n');
}

function prepareReceivedCorpus(data: IntegrationData, maxEmails: number = 150): string {
  return data.emails.received.slice(0, maxEmails).map((e, i) =>
    '--- Email ' + (i + 1) + ' ---\nFrom: ' + e.from + '\nSubject: ' + e.subject + '\nDate: ' + e.date + '\nLabels: ' + e.labels.join(', ')
  ).join('\n\n');
}

function prepareCalendarCorpus(data: IntegrationData): string {
  const all = [...data.calendar.pastEvents, ...data.calendar.futureEvents];
  return all.map(e =>
    e.title + ' | ' + e.start + ' | attendees: ' + e.attendees.map(a => a.email + (a.name ? ' (' + a.name + ')' : '')).join(', ') + (e.recurring ? ' [RECURRING]' : '') + (e.location ? ' @ ' + e.location : '')
  ).join('\n');
}

// The JSON output format instruction appended to each prompt
const OUTPUT_FORMAT = '\n\nOUTPUT FORMAT: Return two JSON blocks:\n<memories>[{\"content\":\"...\",\"page_path\":\"...\",\"importance\":0.8,\"temporal\":\"permanent\"}]</memories>\n<entities>[{\"name\":\"...\",\"type\":\"person\",\"source\":\"gmail\",\"context\":\"...\",\"confidence\":0.9,\"attributes\":{}}]</entities>\nBe SPECIFIC. Quote exact phrases. Include ALL entities mentioned.';

// ═══════════════════════════════════════════════════════════════
// PASS 1: Identity & Demographics
// ═══════════════════════════════════════════════════════════════
export function pass_identity(data: IntegrationData, apiKey: string): Promise<AnalysisPassResult> {
  const signatures = data.emails.sent.slice(0, 30).map(e => e.body).join('\n---\n');
  const prompt = 'You are a behavioral analysis engine. Analyze this email data to extract IDENTITY signals about the person.\n\nAccount email: ' + data.accountEmail + '\nTotal sent: ' + data.emails.totalSent + '\nTotal received: ' + data.emails.totalReceived + '\n\nSENT EMAIL SAMPLES (for signature/identity analysis):\n' + signatures.substring(0, 20000) + '\n\nLABELS:\n' + data.labels.map(l => l.name + ' (' + l.type + ')').join(', ') + '\n\nEXTRACT:\n- Email domain analysis (.edu = student? which school?)\n- Full name from signature\n- Title/role from signature\n- Company/organization\n- Location signals (timezone, address in signature)\n- Life stage (student, early career, senior)\n- Any URLs in signature (LinkedIn, personal site, company site)\n- Multiple identity signals (do they present differently?)\n\nUse page_path "identity/profile" for core identity, "identity/signatures" for signature patterns, "identity/online-presence" for URLs found.' + OUTPUT_FORMAT;

  return runPass(apiKey, 'pass_identity', prompt).then(r => ({ passName: 'identity', ...r }));
}

// ═══════════════════════════════════════════════════════════════
// PASS 2: Micro-Linguistic Fingerprints (Writing DNA)
// ═══════════════════════════════════════════════════════════════
export function pass_writing_dna(data: IntegrationData, apiKey: string): Promise<AnalysisPassResult> {
  const corpus = prepareSentCorpus(data, 100);
  const prompt = 'You are a forensic linguistic analyst. Analyze these SENT emails to extract the writer\'s unique linguistic fingerprint. Do NOT summarize email content — analyze HOW they write.\n\nSENT EMAILS:\n' + corpus.substring(0, 80000) + '\n\nEXTRACT WITH EXACT EXAMPLES:\n\n1. GREETING PATTERNS: Every unique greeting used, with frequency count. (e.g., "Hey [Name]!" x15, "Hi [Name]," x3)\n2. CLOSING PATTERNS: Every sign-off used, with frequency. (e.g., "Kind Regards," x12, "-Sam" x2, "Best," x1)\n3. SENTENCE STRUCTURE: Average length, preference for short vs long, sentence rhythm\n4. PUNCTUATION FINGERPRINT: Em dashes, double dashes, ellipses, exclamation frequency, semicolons, parenthetical usage\n5. HEDGING LANGUAGE: Phrases like "I think", "maybe", "quick thought", "just", "probably" — exact phrases with counts\n6. FILLER PHRASES: Recurring multi-word phrases they repeat (e.g., "It\'d mean a lot if...")\n7. EMOJI USAGE: Frequency, which emojis, in what contexts\n8. CAPITALIZATION: ALL CAPS usage, Title Case habits, lowercase preferences\n9. PARAGRAPH STRUCTURE: How they organize multi-paragraph messages, bullet vs prose preference\n10. VOCABULARY LEVEL: Formal vs casual word choices, technical jargon, slang\n\nUse page_path: "communication/writing-dna" for overall patterns, "communication/micro-fingerprints" for detailed stats.' + OUTPUT_FORMAT;

  return runPass(apiKey, 'pass_writing_dna', prompt).then(r => ({ passName: 'writing_dna', ...r }));
}

// ═══════════════════════════════════════════════════════════════
// PASS 3: Tone-Per-Audience Analysis
// ═══════════════════════════════════════════════════════════════
export function pass_tone_audience(data: IntegrationData, apiKey: string): Promise<AnalysisPassResult> {
  const corpus = prepareSentCorpus(data, 100);
  const prompt = 'You are a communication analyst. Analyze these SENT emails to understand how this person SHIFTS their tone depending on the recipient.\n\nSENT EMAILS:\n' + corpus.substring(0, 80000) + '\n\nFor each distinct audience type you can identify (e.g., cold outreach targets, established professional contacts, close collaborators, corporate/HR contacts, academic contacts), extract:\n\n1. FORMALITY LEVEL: How formal vs casual with this audience? Quote examples.\n2. GREETING DIFFERENCES: Do they use different greetings? ("Hey" vs "Hi" vs "Dear")\n3. CLOSING DIFFERENCES: Different sign-offs per audience?\n4. VOCABULARY SHIFTS: Different word choices?\n5. LENGTH DIFFERENCES: Longer or shorter messages?\n6. TONE QUALITIES: Confident? Humble? Deferential? Direct? Quote examples of each.\n7. POSITIONING: How do they position themselves relative to the recipient? (peer, junior, expert)\n\nAlso identify if there are TEMPLATES used with certain audiences — quote the template structure.\n\nUse page_path: "communication/tone-professional" for formal contacts, "communication/tone-casual" for casual, "communication/tone-outreach" for cold outreach, "communication/templates" for detected templates.' + OUTPUT_FORMAT;

  return runPass(apiKey, 'pass_tone_audience', prompt).then(r => ({ passName: 'tone_audience', ...r }));
}

// ═══════════════════════════════════════════════════════════════
// PASS 4: Decision Heuristics
// ═══════════════════════════════════════════════════════════════
export function pass_decisions(data: IntegrationData, apiKey: string): Promise<AnalysisPassResult> {
  const corpus = prepareSentCorpus(data, 80);
  const prompt = 'You are a decision science analyst. Analyze these SENT emails to extract how this person MAKES DECISIONS and PROPOSES actions.\n\nSENT EMAILS:\n' + corpus.substring(0, 60000) + '\n\nEXTRACT:\n\n1. DECISION PHRASES: Exact phrases they use when proposing, accepting, declining, or deferring. Quote each with context.\n2. RISK TOLERANCE: Do they prefer experimenting or planning? Evidence?\n3. SPEED VS QUALITY: Do they favor "ship it" or "let\'s get it right"? Evidence?\n4. SCHEDULING STYLE: How do they propose meetings? Flexible or specific? How many options?\n5. CONFLICT HANDLING: How do they handle mistakes, apologies, rescheduling? Quote examples.\n6. ESCALATION PATTERNS: When do they escalate vs handle themselves?\n7. DELEGATION LANGUAGE: How do they delegate or ask for help?\n\nUse page_path: "decisions/heuristics" for general patterns, "decisions/phrases" for exact phrase library.' + OUTPUT_FORMAT;

  return runPass(apiKey, 'pass_decisions', prompt).then(r => ({ passName: 'decisions', ...r }));
}

// ═══════════════════════════════════════════════════════════════
// PASS 5: Social Graph & Relationships
// ═══════════════════════════════════════════════════════════════
export function pass_social_graph(data: IntegrationData, apiKey: string): Promise<AnalysisPassResult> {
  const sentContacts = data.emails.sent.map(e => 'To: ' + e.to + ' | Subject: ' + e.subject + ' | Date: ' + e.date).join('\n');
  const receivedContacts = data.emails.received.map(e => 'From: ' + e.from + ' | Subject: ' + e.subject + ' | Date: ' + e.date).join('\n');
  const calendarAttendees = prepareCalendarCorpus(data);

  const prompt = 'You are a social network analyst. Build a relationship map from this person\'s email and calendar data.\n\nSENT TO:\n' + sentContacts.substring(0, 30000) + '\n\nRECEIVED FROM:\n' + receivedContacts.substring(0, 30000) + '\n\nCALENDAR EVENTS:\n' + calendarAttendees.substring(0, 20000) + '\n\nFor each contact that appears 2+ times, extract:\n1. NAME & EMAIL\n2. RELATIONSHIP TYPE: boss, peer, mentor, client, vendor, recruiter, friend, academic, cold contact\n3. INTERACTION FREQUENCY: how often they communicate\n4. COMMUNICATION DIRECTION: who initiates more?\n5. ORGANIZATION/COMPANY: where do they work?\n6. CONTEXT: what do they discuss?\n7. POWER DYNAMIC: who is senior/junior?\n\nAlso identify:\n- GROUP DYNAMICS: Are there clusters of people (e.g., team, cohort)?\n- KEY RELATIONSHIPS: Top 5 most important contacts and why\n- CC PATTERNS: Who gets CC\'d together?\n\nUse page_path: "relationships/social-graph" for the overview, "relationships/key-contacts" for top 5, "relationships/groups" for clusters. Create a separate "relationships/[person-name]" entry for each top contact with their full profile.' + OUTPUT_FORMAT;

  return runPass(apiKey, 'pass_social_graph', prompt).then(r => ({ passName: 'social_graph', ...r }));
}

// ═══════════════════════════════════════════════════════════════
// PASS 6: Priority & Attention Model
// ═══════════════════════════════════════════════════════════════
export function pass_priorities(data: IntegrationData, apiKey: string): Promise<AnalysisPassResult> {
  const sentDates = data.emails.sent.map(e => ({ to: e.to, date: e.date, subject: e.subject, isReply: e.isReply }));
  const receivedDates = data.emails.received.map(e => ({ from: e.from, date: e.date, subject: e.subject }));

  const prompt = 'You are a productivity analyst. Analyze this person\'s email and calendar patterns to understand their PRIORITIES and ATTENTION allocation.\n\nSENT EMAILS (with timestamps):\n' + JSON.stringify(sentDates).substring(0, 40000) + '\n\nRECEIVED EMAILS (with timestamps):\n' + JSON.stringify(receivedDates).substring(0, 40000) + '\n\nCALENDAR:\n' + prepareCalendarCorpus(data).substring(0, 15000) + '\n\nEXTRACT:\n\n1. RESPONSE PRIORITIES: Who gets fast replies? Who waits? Who gets ignored?\n2. EMAIL VOLUME: How many sent per day on average? Patterns?\n3. TIME ALLOCATION: Based on email topics + calendar, what takes most of their time?\n4. WHAT THEY IGNORE: Types of emails/contacts that never get replies\n5. MEETING BEHAVIOR: Do they accept most meetings? Decline? Cancel?\n6. URGENCY SIGNALS: What makes them respond quickly? (keywords, people, topics)\n7. IMPLICIT PRIORITIES: What matters most to them based on where they spend attention?\n\nUse page_path: "priorities/attention-model" for the model, "priorities/response-patterns" for response time data, "priorities/what-gets-ignored" for ignored signals.' + OUTPUT_FORMAT;

  return runPass(apiKey, 'pass_priorities', prompt).then(r => ({ passName: 'priorities', ...r }));
}

// ═══════════════════════════════════════════════════════════════
// PASS 7: Behavioral Rhythms
// ═══════════════════════════════════════════════════════════════
export function pass_rhythms(data: IntegrationData, apiKey: string): Promise<AnalysisPassResult> {
  const emailTimes = data.emails.sent.map(e => e.date);
  const calendarTimes = [...data.calendar.pastEvents, ...data.calendar.futureEvents].map(e => e.start + ' - ' + e.end + ': ' + e.title);

  const prompt = 'You are a chronobiology analyst. Analyze this person\'s timestamps to extract their behavioral rhythms.\n\nSENT EMAIL TIMESTAMPS:\n' + emailTimes.join('\n') + '\n\nCALENDAR EVENTS:\n' + calendarTimes.join('\n') + '\n\nEXTRACT:\n\n1. WORKING HOURS: When do they typically work? Core hours vs extended hours.\n2. PEAK PRODUCTIVITY: When are they most active (email volume by hour)?\n3. DAY-OF-WEEK PATTERNS: Which days are busiest?\n4. WEEKEND BEHAVIOR: Do they work weekends? How much?\n5. MORNING VS EVENING: Are they an early bird or night owl?\n6. MEETING DENSITY: How many meetings per day on average? When are they clustered?\n7. DEEP WORK WINDOWS: When are there NO meetings and NO email activity? (potential focus time)\n8. RESPONSE LATENCY BY TIME: Do they respond faster in morning vs evening?\n\nUse page_path: "rhythms/working-hours", "rhythms/peak-times", "rhythms/weekly-patterns".' + OUTPUT_FORMAT;

  return runPass(apiKey, 'pass_rhythms', prompt).then(r => ({ passName: 'rhythms', ...r }));
}

// ═══════════════════════════════════════════════════════════════
// PASS 8: Template & Pattern Detection
// ═══════════════════════════════════════════════════════════════
export function pass_templates(data: IntegrationData, apiKey: string): Promise<AnalysisPassResult> {
  const corpus = prepareSentCorpus(data, 100);
  const prompt = 'You are a template detection system. Analyze these SENT emails to find RECURRING STRUCTURES — emails that follow the same pattern or template.\n\nSENT EMAILS:\n' + corpus.substring(0, 80000) + '\n\nEXTRACT:\n\n1. TEMPLATES: For each detected template, output:\n   - Template name (e.g., "Cold Outreach Template", "Meeting Followup")\n   - The template structure (with [VARIABLE] placeholders where content changes)\n   - How many emails match this template\n   - What gets customized per recipient (and what stays identical)\n   - Example of a filled-in version\n\n2. RECURRING PATTERNS: Non-template but repeated structures:\n   - Scheduling patterns (how they propose meetings)\n   - Apology patterns\n   - Follow-up patterns\n   - Thank-you patterns\n\n3. EMAIL STRUCTURE HABITS:\n   - Do they use bullet points or prose?\n   - Single paragraph or multi-paragraph?\n   - Do they quote previous emails?\n   - Do they use formatting (bold, links)?\n\nUse page_path: "communication/templates" for each detected template, "communication/patterns" for recurring non-template patterns.' + OUTPUT_FORMAT;

  return runPass(apiKey, 'pass_templates', prompt).then(r => ({ passName: 'templates', ...r }));
}

// ═══════════════════════════════════════════════════════════════
// PASS 9: Projects & Current Context
// ═══════════════════════════════════════════════════════════════
export function pass_projects(data: IntegrationData, apiKey: string): Promise<AnalysisPassResult> {
  const recentSent = prepareSentCorpus(data, 50);
  const recentReceived = data.emails.received.slice(0, 50).map(e => 'From: ' + e.from + ' | Subject: ' + e.subject + ' | ' + e.snippet).join('\n');
  const calendar = prepareCalendarCorpus(data);

  const prompt = 'You are a project analyst. Analyze this person\'s recent emails and calendar to understand WHAT they are working on and their current priorities.\n\nRECENT SENT EMAILS:\n' + recentSent.substring(0, 40000) + '\n\nRECENT RECEIVED EMAILS:\n' + recentReceived.substring(0, 20000) + '\n\nCALENDAR (past 90 days + next 30):\n' + calendar.substring(0, 20000) + '\n\nEXTRACT:\n\n1. ACTIVE PROJECTS: What are they working on? Name each project, describe it, list who\'s involved.\n2. THIS WEEK\'S PRIORITIES: What\'s urgent right now based on recent emails + upcoming calendar?\n3. GOALS: Any career/business/personal goals evident from the data?\n4. DEADLINES: Upcoming deadlines mentioned in emails or calendar.\n5. APPLICATIONS/JOB SEARCH: Any evidence of job applications, interviews, or career exploration?\n6. NETWORKING: Who are they actively building relationships with? For what purpose?\n7. LEARNING: Topics they\'re exploring or learning about.\n\nClassify each finding as:\n- permanent (ongoing project/goal)\n- monthly (current focus)\n- weekly (this week\'s priority)\n- ephemeral (one-time thing)\n\nUse page_path: "projects/active" for ongoing projects, "projects/this-week" for weekly priorities, "projects/goals" for goals, "projects/networking" for networking activity.' + OUTPUT_FORMAT;

  return runPass(apiKey, 'pass_projects', prompt).then(r => ({ passName: 'projects', ...r }));
}

// ═══════════════════════════════════════════════════════════════
// PASS 10: Email Organization & Preferences
// ═══════════════════════════════════════════════════════════════
export function pass_organization(data: IntegrationData, apiKey: string): Promise<AnalysisPassResult> {
  const labelsStr = data.labels.map(l => l.name + ' (' + l.type + ') - ' + (l.messagesTotal || '?') + ' messages').join('\n');
  const sampleLabels = data.emails.sent.slice(0, 50).map(e => 'Subject: ' + e.subject + ' | Labels: ' + e.labels.join(', ')).join('\n');

  const prompt = 'You are an organizational psychologist. Analyze this person\'s email organization to understand HOW THEY THINK and organize information.\n\nEMAIL LABELS:\n' + labelsStr + '\n\nSAMPLE EMAILS WITH THEIR LABELS:\n' + sampleLabels.substring(0, 15000) + '\n\nEXTRACT:\n\n1. LABEL SYSTEM: What system do they use? What does each label mean? How do they categorize?\n2. ORGANIZATIONAL STYLE: Methodical? Chaotic? Minimal? Over-organized?\n3. WHAT THE LABELS REVEAL: The categories they create reveal how they think about their world. What mental model does this suggest?\n4. PREFERENCES:\n   - Do they prefer concise or detailed messages?\n   - Lists or prose?\n   - Speed or thoroughness?\n   - Data-driven or intuitive?\n5. PRODUCTIVITY SYSTEM: Any evidence of GTD, inbox zero, or other productivity methods?\n\nUse page_path: "workflows/email-organization" for label analysis, "preferences/communication-style" for preferences, "preferences/work-style" for productivity patterns.' + OUTPUT_FORMAT;

  return runPass(apiKey, 'pass_organization', prompt).then(r => ({ passName: 'organization', ...r }));
}

// Export all passes as a map
export const ALL_PASSES = {
  identity: pass_identity,
  writing_dna: pass_writing_dna,
  tone_audience: pass_tone_audience,
  decisions: pass_decisions,
  social_graph: pass_social_graph,
  priorities: pass_priorities,
  rhythms: pass_rhythms,
  templates: pass_templates,
  projects: pass_projects,
  organization: pass_organization,
};

export type PassName = keyof typeof ALL_PASSES;
