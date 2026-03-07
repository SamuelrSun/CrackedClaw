/**
 * Integration Routing Logic
 * Intelligently decides when to use API vs browser automation
 */

import { getIntegration, type IntegrationConfig } from './registry';

export type RoutingMethod = 'api' | 'browser';

export interface RoutingDecision {
  method: RoutingMethod;
  reason: string;
  fallbackAvailable: boolean;
  confidence: number;  // 0-1, how confident we are in this decision
  integration: IntegrationConfig | null;
}

export interface RoutingContext {
  apiAvailable: boolean;
  browserAvailable: boolean;
  previousApiError?: string;
  userPreference?: RoutingMethod;
  taskType?: 'read' | 'write' | 'visual' | 'interactive';
}

/**
 * Keywords that strongly suggest browser automation is needed
 */
const BROWSER_KEYWORDS = [
  // Visual inspection
  'look at', 'looks like', 'see the', 'check the formatting',
  'see how', 'show me', 'looks correct', 'visual', 'screenshot',
  'appearance', 'layout', 'design', 'colors', 'styling', 'css',
  'preview', 'rendering', 'display', 'ui', 'interface',
  
  // Interactive tasks
  'click', 'scroll', 'navigate', 'browse', 'explore',
  'fill out', 'submit form', 'download from', 'upload to site',
  'log in', 'login', 'sign in', 'authenticate manually',
  
  // Scraping/extraction
  'scrape', 'extract from page', 'parse html', 'get from website',
  'crawl', 'web page', 'from their website',
  
  // Unsupported operations
  "that api doesn't support", "can't do via api",
];

/**
 * Keywords that suggest API is sufficient
 */
const API_KEYWORDS = [
  'send', 'create', 'update', 'delete', 'list', 'get', 'fetch',
  'search', 'query', 'filter', 'find', 'read', 'write',
  'add', 'remove', 'modify', 'edit', 'change',
  'schedule', 'automate', 'sync', 'integrate',
];

/**
 * Errors that suggest browser fallback
 */
const FALLBACK_ERROR_PATTERNS = [
  /rate limit/i,
  /too many requests/i,
  /403|forbidden/i,
  /unauthorized|unauthenticated/i,
  /permission denied/i,
  /scope.*required/i,
  /not supported/i,
  /deprecated/i,
  /feature.*unavailable/i,
  /api.*disabled/i,
  /quota.*exceeded/i,
  /timeout/i,
];

/**
 * Detect if a task requires browser-based automation
 */
export function requiresBrowser(task: string): { required: boolean; reason: string } {
  const lower = task.toLowerCase();
  
  for (const keyword of BROWSER_KEYWORDS) {
    if (lower.includes(keyword)) {
      return {
        required: true,
        reason: `Task involves "${keyword}" which requires visual/browser access`,
      };
    }
  }
  
  return { required: false, reason: 'Task can be handled via API' };
}

/**
 * Check if an API error should trigger browser fallback
 */
export function shouldFallbackToBrowser(error: Error | string): { fallback: boolean; reason: string } {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  for (const pattern of FALLBACK_ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return {
        fallback: true,
        reason: `API error (${pattern.source}) - browser can bypass this`,
      };
    }
  }
  
  return { fallback: false, reason: 'Error is not recoverable via browser' };
}

/**
 * Score how well a task matches API vs browser
 */
function scoreTaskMethod(task: string): { api: number; browser: number } {
  const lower = task.toLowerCase();
  let apiScore = 0;
  let browserScore = 0;
  
  for (const keyword of API_KEYWORDS) {
    if (lower.includes(keyword)) {
      apiScore += 1;
    }
  }
  
  for (const keyword of BROWSER_KEYWORDS) {
    if (lower.includes(keyword)) {
      browserScore += 2;  // Browser keywords are more decisive
    }
  }
  
  return { api: apiScore, browser: browserScore };
}

/**
 * Main routing function - decides how to handle a task
 */
export function routeIntegrationTask(
  integrationId: string,
  task: string,
  context: RoutingContext
): RoutingDecision {
  const integration = getIntegration(integrationId);
  
  // Unknown integration - browser only
  if (!integration) {
    return {
      method: 'browser',
      reason: `Unknown integration "${integrationId}" - using browser automation`,
      fallbackAvailable: false,
      confidence: 0.5,
      integration: null,
    };
  }
  
  // User preference overrides (but still check validity)
  if (context.userPreference) {
    if (context.userPreference === 'api' && context.apiAvailable && integration.hasApi) {
      return {
        method: 'api',
        reason: 'User prefers API access',
        fallbackAvailable: integration.browserFallback && context.browserAvailable,
        confidence: 0.9,
        integration,
      };
    }
    if (context.userPreference === 'browser' && context.browserAvailable) {
      return {
        method: 'browser',
        reason: 'User prefers browser automation',
        fallbackAvailable: integration.hasApi && context.apiAvailable,
        confidence: 0.9,
        integration,
      };
    }
  }
  
  // Check if task requires browser
  const browserCheck = requiresBrowser(task);
  if (browserCheck.required) {
    if (context.browserAvailable) {
      return {
        method: 'browser',
        reason: browserCheck.reason,
        fallbackAvailable: false,  // Browser is required, not a fallback
        confidence: 0.95,
        integration,
      };
    } else {
      // Need browser but not available
      return {
        method: 'api',
        reason: 'Task needs browser but none available - attempting API',
        fallbackAvailable: false,
        confidence: 0.3,
        integration,
      };
    }
  }
  
  // Check previous API error
  if (context.previousApiError) {
    const fallbackCheck = shouldFallbackToBrowser(context.previousApiError);
    if (fallbackCheck.fallback && context.browserAvailable && integration.browserFallback) {
      return {
        method: 'browser',
        reason: fallbackCheck.reason,
        fallbackAvailable: false,  // Already using fallback
        confidence: 0.85,
        integration,
      };
    }
  }
  
  // Score the task
  const scores = scoreTaskMethod(task);
  
  // Integration has no API - browser only
  if (!integration.hasApi) {
    if (context.browserAvailable) {
      return {
        method: 'browser',
        reason: `${integration.name} has no API - using browser automation`,
        fallbackAvailable: false,
        confidence: 0.9,
        integration,
      };
    } else {
      return {
        method: 'browser',
        reason: `${integration.name} requires browser but none available`,
        fallbackAvailable: false,
        confidence: 0.1,
        integration,
      };
    }
  }
  
  // Both available - choose based on task
  if (context.apiAvailable && context.browserAvailable) {
    if (scores.browser > scores.api) {
      return {
        method: 'browser',
        reason: 'Task characteristics suggest browser is better',
        fallbackAvailable: true,
        confidence: 0.7 + (scores.browser - scores.api) * 0.05,
        integration,
      };
    } else {
      return {
        method: 'api',
        reason: 'API is faster and more reliable for this task',
        fallbackAvailable: true,
        confidence: 0.8 + scores.api * 0.02,
        integration,
      };
    }
  }
  
  // Only API available
  if (context.apiAvailable) {
    return {
      method: 'api',
      reason: 'Using API (browser not available)',
      fallbackAvailable: false,
      confidence: 0.75,
      integration,
    };
  }
  
  // Only browser available
  if (context.browserAvailable) {
    return {
      method: 'browser',
      reason: 'Using browser (API not connected)',
      fallbackAvailable: false,
      confidence: 0.75,
      integration,
    };
  }
  
  // Neither available
  return {
    method: 'api',
    reason: 'Neither API nor browser available - will require setup',
    fallbackAvailable: false,
    confidence: 0,
    integration,
  };
}

/**
 * Detect the integration from a task description
 */
export function detectIntegration(task: string): IntegrationConfig | null {
  const lower = task.toLowerCase();
  
  // Direct mentions
  const integrationMentions: Record<string, string[]> = {
    google: ['gmail', 'google', 'gdrive', 'gsheet', 'google docs', 'google calendar', 'google drive', 'google sheets'],
    microsoft: ['outlook', 'microsoft', 'office', 'onedrive', 'teams', 'excel', 'word'],
    slack: ['slack'],
    notion: ['notion'],
    github: ['github', 'gh', 'repo', 'repository', 'pull request', 'pr'],
    linkedin: ['linkedin'],
    twitter: ['twitter', 'tweet', 'x.com'],
    hubspot: ['hubspot'],
    salesforce: ['salesforce', 'sfdc'],
    airtable: ['airtable'],
    trello: ['trello'],
    jira: ['jira'],
    discord: ['discord'],
    telegram: ['telegram'],
    whatsapp: ['whatsapp'],
    instagram: ['instagram', 'ig'],
    facebook: ['facebook', 'fb'],
  };
  
  for (const [id, keywords] of Object.entries(integrationMentions)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return getIntegration(id) || null;
      }
    }
  }
  
  return null;
}

/**
 * Get routing recommendation for a natural language task
 */
export function routeTask(
  task: string,
  context: Omit<RoutingContext, 'apiAvailable'> & { connectedApis: string[] }
): RoutingDecision {
  const integration = detectIntegration(task);
  
  if (!integration) {
    // No specific integration detected - default to browser
    return {
      method: 'browser',
      reason: 'No specific integration detected - using browser for flexibility',
      fallbackAvailable: false,
      confidence: 0.5,
      integration: null,
    };
  }
  
  const apiAvailable = context.connectedApis.includes(integration.id);
  
  return routeIntegrationTask(integration.id, task, {
    ...context,
    apiAvailable,
  });
}

/**
 * Batch route multiple tasks
 */
export function routeTasks(
  tasks: string[],
  context: Omit<RoutingContext, 'apiAvailable'> & { connectedApis: string[] }
): RoutingDecision[] {
  return tasks.map((task) => routeTask(task, context));
}
