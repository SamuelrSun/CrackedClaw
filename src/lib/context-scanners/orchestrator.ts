/**
 * Context Scanner Orchestrator
 * Runs multiple scanners in parallel, aggregates results, and generates combined insights
 */

import { createClient } from '@/lib/supabase/server';
import { getValidTokens } from '@/lib/oauth/utils';
import type {
  Scanner,
  ScannerResult,
  ScanOptions,
  ContextGatheringResult,
  ContextGatheringJob,
  WorkflowSuggestion,
  Insight,
} from './types';
import { gmailScanner } from './gmail';
import { calendarScanner } from './calendar';

// Registry of available scanners
const SCANNERS: Record<string, Scanner> = {
  gmail: gmailScanner,
  calendar: calendarScanner,
};

// Map integration names to scanner IDs
const INTEGRATION_TO_SCANNER: Record<string, string> = {
  google: 'gmail', // Google OAuth gives access to Gmail
  gmail: 'gmail',
  calendar: 'calendar',
  'google-calendar': 'calendar',
};

// In-memory job storage (in production, use database table context_gathering_jobs)
const jobStore = new Map<string, ContextGatheringJob>();

/**
 * Start a context gathering job
 */
export async function startContextGathering(
  userId: string,
  integrations: string[],
  options?: ScanOptions
): Promise<string> {
  const jobId = crypto.randomUUID();
  
  // Map integrations to scanners
  const scannerIds = new Set<string>();
  for (const integration of integrations) {
    const scannerId = INTEGRATION_TO_SCANNER[integration.toLowerCase()];
    if (scannerId && SCANNERS[scannerId]) {
      scannerIds.add(scannerId);
    }
  }
  
  const job: ContextGatheringJob = {
    id: jobId,
    userId,
    status: 'pending',
    integrations: Array.from(scannerIds),
    progress: {
      current: 0,
      total: scannerIds.size,
      message: 'Starting context gathering...',
    },
    results: [],
    combinedInsights: [],
    suggestedWorkflows: [],
    startedAt: new Date().toISOString(),
  };
  
  jobStore.set(jobId, job);
  
  // Also save to database for persistence
  try {
    const supabase = await createClient();
    await supabase.from('context_gathering_jobs').insert({
      id: jobId,
      user_id: userId,
      status: 'pending',
      integrations: Array.from(scannerIds),
      progress: job.progress,
      started_at: job.startedAt,
    });
  } catch (err) {
    console.error('Failed to persist job to database:', err);
  }
  
  // Run in background (non-blocking)
  runContextGatheringJob(jobId, userId, Array.from(scannerIds), options).catch(err => {
    console.error('Context gathering job failed:', err);
    const job = jobStore.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = err.message;
      job.completedAt = new Date().toISOString();
    }
  });
  
  return jobId;
}

/**
 * Get job status
 */
export function getJobStatus(jobId: string): ContextGatheringJob | null {
  return jobStore.get(jobId) || null;
}

/**
 * Run the actual context gathering
 */
async function runContextGatheringJob(
  jobId: string,
  userId: string,
  scannerIds: string[],
  options?: ScanOptions
): Promise<void> {
  const job = jobStore.get(jobId);
  if (!job) return;
  
  job.status = 'running';
  
  // Update DB status
  const supabase = await createClient();
  await supabase.from('context_gathering_jobs').update({ status: 'running' }).eq('id', jobId);
  
  const results: ScannerResult[] = [];
  
  // Run scanners (could parallelize, but being cautious with rate limits)
  for (let i = 0; i < scannerIds.length; i++) {
    const scannerId = scannerIds[i];
    const scanner = SCANNERS[scannerId];
    
    if (!scanner) continue;
    
    job.progress = {
      current: i,
      total: scannerIds.length,
      currentScanner: scanner.name,
      message: `Scanning ${scanner.name}...`,
    };
    
    // Update DB progress
    await supabase.from('context_gathering_jobs').update({ 
      progress: job.progress 
    }).eq('id', jobId);
    
    try {
      // Get valid access token for the provider
      const provider = scannerId === 'gmail' ? 'google' : 'google'; // All use Google OAuth for now
      const tokens = await getValidTokens(userId, provider);
      
      if (!tokens) {
        console.warn(`No valid tokens for ${scannerId}, skipping`);
        continue;
      }
      
      const result = await scanner.scan(userId, tokens.accessToken, options);
      results.push(result);
      
      // Update progress
      job.progress.message = `Completed ${scanner.name} (${result.stats?.itemsScanned || 0} items)`;
      
    } catch (error) {
      console.error(`Scanner ${scannerId} failed:`, error);
      // Continue with other scanners
    }
  }
  
  job.progress = {
    current: scannerIds.length,
    total: scannerIds.length,
    message: 'Generating insights...',
  };
  
  // Generate combined insights
  const combinedInsights = generateCombinedInsights(results);
  const suggestedWorkflows = generateWorkflowSuggestions(results, combinedInsights);
  
  // Save to database
  await saveContextResults(userId, results, combinedInsights, suggestedWorkflows);
  
  // Update job
  job.status = 'completed';
  job.results = results;
  job.combinedInsights = combinedInsights;
  job.suggestedWorkflows = suggestedWorkflows;
  job.completedAt = new Date().toISOString();
  job.progress.message = 'Context gathering complete!';
  
  // Update DB with final state
  await supabase.from('context_gathering_jobs').update({
    status: 'completed',
    progress: job.progress,
    results: results.map(r => ({
      ...r,
      scannedAt: r.scannedAt.toISOString(),
    })),
    combined_insights: combinedInsights,
    suggested_workflows: suggestedWorkflows,
    completed_at: job.completedAt,
  }).eq('id', jobId);
}

/**
 * Run context gathering synchronously (for API calls that need to wait)
 */
export async function runContextGathering(
  userId: string,
  integrations: string[],
  options?: ScanOptions
): Promise<ContextGatheringResult> {
  const startTime = Date.now();
  
  // Map integrations to scanners
  const scannerIds = new Set<string>();
  for (const integration of integrations) {
    const scannerId = INTEGRATION_TO_SCANNER[integration.toLowerCase()];
    if (scannerId && SCANNERS[scannerId]) {
      scannerIds.add(scannerId);
    }
  }
  
  const results: ScannerResult[] = [];
  
  // Run scanners in parallel
  const scanPromises = Array.from(scannerIds).map(async (scannerId) => {
    const scanner = SCANNERS[scannerId];
    if (!scanner) return null;
    
    try {
      const provider = scannerId === 'gmail' ? 'google' : 'google';
      const tokens = await getValidTokens(userId, provider);
      
      if (!tokens) {
        console.warn(`No valid tokens for ${scannerId}`);
        return null;
      }
      
      return await scanner.scan(userId, tokens.accessToken, options);
    } catch (error) {
      console.error(`Scanner ${scannerId} failed:`, error);
      return null;
    }
  });
  
  const scanResults = await Promise.all(scanPromises);
  results.push(...scanResults.filter(Boolean) as ScannerResult[]);
  
  // Generate combined insights
  const combinedInsights = generateCombinedInsights(results);
  const suggestedWorkflows = generateWorkflowSuggestions(results, combinedInsights);
  
  // Save to database
  await saveContextResults(userId, results, combinedInsights, suggestedWorkflows);
  
  return {
    results,
    combinedInsights,
    suggestedWorkflows,
    timeMs: Date.now() - startTime,
  };
}

/**
 * Generate human-readable combined insights
 */
function generateCombinedInsights(results: ScannerResult[]): string[] {
  const insights: string[] = [];
  
  // Collect all insights across scanners
  const allInsights: Insight[] = results.flatMap(r => r.insights);
  
  // Sort by confidence and pick top ones
  const topInsights = allInsights
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);
  
  // Format as human-readable strings
  for (const insight of topInsights) {
    insights.push(insight.content);
  }
  
  // Add cross-scanner insights
  const gmailResult = results.find(r => r.source === 'gmail') as any;
  const calendarResult = results.find(r => r.source === 'calendar') as any;
  
  if (gmailResult?.data?.frequentContacts && calendarResult?.data?.frequentAttendees) {
    const emailContacts = new Set(gmailResult.data.frequentContacts.map((c: any) => c.email));
    const meetingContacts = calendarResult.data.frequentAttendees.map((a: any) => a.email);
    
    const overlap = meetingContacts.filter((email: string) => emailContacts.has(email));
    if (overlap.length >= 3) {
      insights.push(`${overlap.length} people appear in both your frequent emails and meetings — these are your key collaborators`);
    }
  }
  
  return insights;
}

/**
 * Generate workflow suggestions based on scan results
 */
function generateWorkflowSuggestions(
  results: ScannerResult[],
  combinedInsights: string[]
): WorkflowSuggestion[] {
  const suggestions: WorkflowSuggestion[] = [];
  
  const gmailResult = results.find(r => r.source === 'gmail') as any;
  const calendarResult = results.find(r => r.source === 'calendar') as any;
  
  // Newsletter management workflow
  if (gmailResult?.data?.patterns) {
    const newsletterPattern = gmailResult.data.patterns.find((p: any) => p.type === 'newsletter');
    if (newsletterPattern && newsletterPattern.count >= 10) {
      suggestions.push({
        id: 'newsletter-digest',
        name: 'Newsletter Digest',
        description: `Auto-archive ${newsletterPattern.count} newsletters and send a weekly digest`,
        trigger: 'New newsletter email arrives',
        actions: [
          'Archive immediately',
          'Summarize content',
          'Add to weekly digest',
          'Send digest every Sunday'
        ],
        requiredIntegrations: ['gmail'],
        confidence: Math.min(newsletterPattern.count / 30, 0.95),
        basedOn: `${newsletterPattern.count} newsletters detected`,
      });
    }
  }
  
  // Receipt tracking workflow
  if (gmailResult?.data?.patterns) {
    const receiptPattern = gmailResult.data.patterns.find((p: any) => p.type === 'receipt');
    if (receiptPattern && receiptPattern.count >= 5) {
      suggestions.push({
        id: 'expense-tracking',
        name: 'Auto Expense Tracking',
        description: 'Automatically extract and log expenses from email receipts',
        trigger: 'Receipt email detected',
        actions: [
          'Extract merchant and amount',
          'Categorize expense',
          'Log to spreadsheet',
          'Label and archive email'
        ],
        requiredIntegrations: ['gmail', 'sheets'],
        confidence: 0.8,
        basedOn: `${receiptPattern.count} receipts detected`,
      });
    }
  }
  
  // Meeting prep workflow
  if (calendarResult?.data?.recurringMeetings && calendarResult.data.recurringMeetings.length >= 2) {
    suggestions.push({
      id: 'meeting-prep',
      name: 'Meeting Prep Assistant',
      description: 'Get prepared for recurring meetings with auto-generated agendas',
      trigger: '30 minutes before recurring meeting',
      actions: [
        'Pull notes from last meeting',
        'Check for relevant emails',
        'Generate agenda suggestions',
        'Send reminder with prep materials'
      ],
      requiredIntegrations: ['calendar', 'gmail'],
      confidence: 0.85,
      basedOn: `${calendarResult.data.recurringMeetings.length} recurring meetings`,
    });
  }
  
  // Follow-up workflow
  if (gmailResult?.data?.pendingThreads && gmailResult.data.pendingThreads.length >= 3) {
    const waitingForThem = gmailResult.data.pendingThreads.filter((t: any) => t.waitingFor === 'them').length;
    if (waitingForThem >= 2) {
      suggestions.push({
        id: 'follow-up-reminders',
        name: 'Follow-up Reminders',
        description: 'Get reminded to follow up on emails that haven\'t received replies',
        trigger: 'Email sent without reply after 3 days',
        actions: [
          'Check if reply received',
          'Create follow-up reminder',
          'Draft polite follow-up',
          'Track response'
        ],
        requiredIntegrations: ['gmail'],
        confidence: 0.75,
        basedOn: `${waitingForThem} emails awaiting response`,
      });
    }
  }
  
  // VIP contacts workflow
  if (gmailResult?.data?.frequentContacts && gmailResult.data.frequentContacts.length >= 5) {
    const topContacts = gmailResult.data.frequentContacts.slice(0, 5);
    suggestions.push({
      id: 'vip-inbox',
      name: 'VIP Inbox Priority',
      description: 'Prioritize and surface emails from your most important contacts',
      trigger: 'Email from VIP contact',
      actions: [
        'Star and move to priority',
        'Send mobile notification',
        'Track response time',
        'Suggest quick replies'
      ],
      requiredIntegrations: ['gmail'],
      confidence: 0.9,
      basedOn: `${topContacts.length} frequent contacts identified`,
    });
  }
  
  // Sort by confidence
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Save context results to database
 */
async function saveContextResults(
  userId: string,
  results: ScannerResult[],
  combinedInsights: string[],
  suggestedWorkflows: WorkflowSuggestion[]
): Promise<void> {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();
    
    // Save individual scan results to user_context
    for (const result of results) {
      // Use upsert with scan_type as the unique key
      const { error } = await supabase
        .from('user_context')
        .upsert({
          user_id: userId,
          source: result.source,
          scan_type: result.source, // e.g., 'gmail', 'calendar'
          content: result, // Full result object
          scan_result: result,
          insights: result.insights,
          suggested_automations: result.suggestedAutomations,
          scanned_at: result.scannedAt.toISOString(),
          updated_at: now,
          confidence: 1.0,
        }, {
          onConflict: 'user_id,scan_type',
        });
      
      if (error) {
        console.error('Error saving context result:', error);
      }
    }
    
  } catch (error) {
    console.error('Failed to save context results:', error);
    // Don't throw - saving is best effort
  }
}

/**
 * Get latest context findings for a user
 */
export async function getContextFindings(userId: string): Promise<{
  results: ScannerResult[];
  combinedInsights: string[];
  suggestedWorkflows: WorkflowSuggestion[];
  lastScanned?: string;
} | null> {
  try {
    const supabase = await createClient();
    
    const { data: contextRows, error } = await supabase
      .from('user_context')
      .select('*')
      .eq('user_id', userId)
      .not('scan_result', 'is', null)
      .order('scanned_at', { ascending: false });
    
    if (error || !contextRows?.length) {
      return null;
    }
    
    const results = contextRows
      .filter(row => row.scan_result)
      .map(row => {
        const result = row.scan_result as ScannerResult;
        // Ensure scannedAt is a Date
        if (typeof result.scannedAt === 'string') {
          result.scannedAt = new Date(result.scannedAt);
        }
        return result;
      });
    
    const combinedInsights = generateCombinedInsights(results);
    const suggestedWorkflows = generateWorkflowSuggestions(results, combinedInsights);
    
    return {
      results,
      combinedInsights,
      suggestedWorkflows,
      lastScanned: contextRows[0]?.scanned_at,
    };
  } catch (error) {
    console.error('Failed to get context findings:', error);
    return null;
  }
}

/**
 * Get available scanners info
 */
export function getAvailableScanners(): Array<{
  id: string;
  name: string;
  emoji: string;
  description: string;
}> {
  return Object.values(SCANNERS).map(scanner => ({
    id: scanner.id,
    name: scanner.name,
    emoji: scanner.emoji,
    description: scanner.description,
  }));
}
