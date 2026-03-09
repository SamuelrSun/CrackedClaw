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
  | 'general';

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
