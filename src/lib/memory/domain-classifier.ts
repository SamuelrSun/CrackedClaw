/**
 * Simple domain/intent classifier for tagging memories by topic.
 */

export type MemoryDomain =
  | 'email'
  | 'calendar'
  | 'coding'
  | 'job_search'
  | 'sales'
  | 'fenna'
  | 'general'
  | 'user:profile'
  | 'user:workflows'
  | 'user:communication';

export function classifyDomain(message: string): MemoryDomain {
  const lower = message.toLowerCase();
  if (/email|inbox|gmail|outlook|send|draft|compose|mailbox/.test(lower)) return 'email';
  if (/calendar|meeting|event|schedule|appointment|zoom|standup/.test(lower)) return 'calendar';
  if (/code|build|deploy|bug|feature|github|repo|pull request|pr |commit/.test(lower)) return 'coding';
  if (/job|internship|resume|apply|interview|linkedin|hiring|recruiter/.test(lower)) return 'job_search';
  if (/lead|outreach|cold email|prospect|sales|crm|pipeline/.test(lower)) return 'sales';
  if (/fenna|ar glasses|xr|wearable|rokid|startup|founders/.test(lower)) return 'fenna';
  return 'general';
}

/**
 * Classify outreach-specific content into cross-campaign user model domains.
 * Pass `context` to force a specific domain; omit to auto-detect.
 */
export function classifyOutreachDomain(
  content: string,
  context?: 'profile' | 'workflow' | 'communication'
): string {
  if (context) return `user:${context}`;
  const lower = content.toLowerCase();
  if (/how i write|tone|style|draft|message|subject line|follow.?up|email template/.test(lower)) {
    return 'user:communication';
  }
  if (/how i find|discovery|search|google maps|linkedin search|where to look|workflow/.test(lower)) {
    return 'user:workflows';
  }
  if (/i prefer|i value|i look for|i avoid|good lead|bad lead|criteria|pattern|signal/.test(lower)) {
    return 'user:profile';
  }
  return 'user:profile'; // default for outreach-extracted facts
}
