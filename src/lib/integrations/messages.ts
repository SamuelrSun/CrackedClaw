/**
 * User-Facing Integration Messages
 * Smart message generation for agent responses about integrations
 */

import { 
  INTEGRATIONS, 
  getIntegration, 
  getIntegrationsWithApi, 
  getIntegrationsWithBrowserOnly,
  type IntegrationConfig 
} from './registry';

/**
 * Get the intro message about available integrations
 */
export function getIntegrationIntroMessage(options?: {
  connectedCount?: number;
  includeExamples?: boolean;
}): string {
  const apiCount = getIntegrationsWithApi().length;
  const browserOnlyCount = getIntegrationsWithBrowserOnly().length;
  
  const examples = ['Google Workspace', 'Slack', 'Notion', 'GitHub', 'HubSpot'];
  const exampleStr = options?.includeExamples !== false 
    ? ` like ${examples.slice(0, 3).join(', ')}, and more` 
    : '';
  
  if (options?.connectedCount && options.connectedCount > 0) {
    return `You have ${options.connectedCount} integrations connected. I can access ${apiCount}+ apps via API${exampleStr}. For anything else — or when you need visual tasks done — I can use your browser.`;
  }
  
  return `I can connect to ${apiCount}+ apps via API${exampleStr}. For anything else — like LinkedIn, WhatsApp, or any website — I can use your browser directly.`;
}

/**
 * Short version for onboarding prompts
 */
export function getIntegrationIntroShort(): string {
  const apiCount = getIntegrationsWithApi().length;
  return `${apiCount}+ API integrations available, plus unlimited browser access`;
}

/**
 * Message when API fails and browser fallback is available
 */
export function getApiFallbackMessage(
  integrationId: string, 
  error: string,
  options?: { suggestBrowser?: boolean }
): string {
  const integration = getIntegration(integrationId);
  const name = integration?.name || integrationId;
  
  // Clean up error message
  const cleanError = error
    .replace(/^Error:\s*/i, '')
    .replace(/\.$/, '');
  
  if (options?.suggestBrowser === false || !integration?.browserFallback) {
    return `I ran into an issue with ${name}: ${cleanError}. Let me try a different approach.`;
  }
  
  // Check if it needs login
  if (integration?.authType === 'browser-login') {
    return `The API isn't working for ${name} (${cleanError}). Want me to try via browser instead? You'll need to be logged into ${name} first.`;
  }
  
  return `The API isn't cooperating (${cleanError}). Want me to try this via browser instead? It's a bit slower but should work.`;
}

/**
 * Message when browser is required for a task
 */
export function getBrowserRequiredMessage(
  integrationId: string,
  reason: string
): string {
  const integration = getIntegration(integrationId);
  const name = integration?.name || integrationId;
  
  // Format reason for natural reading
  const reasonFormatted = reason
    .replace(/^Task involves "/, 'I need to ')
    .replace(/" which requires.*$/, '')
    .replace(/requires? visual\/browser access/i, '');
  
  if (integration?.hasApi) {
    return `${reasonFormatted.charAt(0).toUpperCase() + reasonFormatted.slice(1).trim()} — I'll need to use the browser for that. Let me open ${name}.`;
  }
  
  return `I'll need to open ${name} in your browser for this — just make sure you're logged in and I'll take care of the rest.`;
}

/**
 * Message when an integration needs to be set up
 */
export function getSetupRequiredMessage(
  integrationId: string,
  options?: { 
    forTask?: string;
    suggestAlternative?: boolean;
  }
): string {
  const integration = getIntegration(integrationId);
  const name = integration?.name || integrationId;
  
  if (!integration) {
    return `I don't have access to ${name} yet. Want me to set it up?`;
  }
  
  const taskContext = options?.forTask 
    ? ` to ${options.forTask.toLowerCase().replace(/\.$/, '')}`
    : '';
  
  if (integration.hasApi) {
    if (integration.authType === 'oauth') {
      return `I'll need to connect to ${name}${taskContext}. Click below to authorize access:`;
    } else if (integration.authType === 'api-key') {
      return `I'll need an API key for ${name}${taskContext}. You can add it in Settings → Integrations.`;
    }
  }
  
  if (integration.browserFallback) {
    return `${name} requires browser access${taskContext}. I can use your browser — just make sure you're logged into ${name}.`;
  }
  
  return `I need access to ${name}${taskContext}. Let's get that set up.`;
}

/**
 * Explain why browser vs API
 */
export function getMethodExplanation(method: 'api' | 'browser', integrationId?: string): string {
  const integration = integrationId ? getIntegration(integrationId) : null;
  const name = integration?.name;
  
  if (method === 'api') {
    if (name) {
      return `Using ${name}'s API — fast and reliable.`;
    }
    return 'Using the API — fast and reliable.';
  }
  
  if (name) {
    if (!integration?.hasApi) {
      return `Opening ${name} in your browser to handle this.`;
    }
    return `Opening ${name} in your browser for this — needed to see the page directly.`;
  }
  
  return 'Opening this in your browser — I can see and interact with the page just like you would.';
}

/**
 * Get capability summary for an integration
 */
export function getCapabilityMessage(integrationId: string): string {
  const integration = getIntegration(integrationId);
  
  if (!integration) {
    return 'I can open this in a browser on your computer.';
  }
  
  const caps = integration.capabilities.slice(0, 4);
  const hasMore = integration.capabilities.length > 4;
  
  const capList = caps.join(', ') + (hasMore ? ', and more' : '');
  
  if (integration.hasApi) {
    return `With ${integration.name}, I can help with ${capList}.`;
  }
  
  return `Through ${integration.name}, I can handle ${capList} by opening it in your browser.`;
}

/**
 * Suggest integrations based on what user wants to do
 */
export function getSuggestionMessage(task: string): { 
  message: string; 
  integrations: IntegrationConfig[];
} {
  const lower = task.toLowerCase();
  const suggestions: IntegrationConfig[] = [];
  
  // Map common task types to integrations
  const taskMappings: Record<string, string[]> = {
    email: ['google', 'microsoft'],
    calendar: ['google', 'microsoft'],
    'project management': ['asana', 'trello', 'linear', 'jira', 'monday', 'clickup'],
    notes: ['notion', 'confluence'],
    code: ['github', 'gitlab'],
    crm: ['hubspot', 'salesforce', 'pipedrive'],
    communication: ['slack', 'discord', 'telegram'],
    social: ['twitter', 'linkedin', 'instagram'],
    files: ['google', 'dropbox', 'box'],
  };
  
  for (const [taskType, ids] of Object.entries(taskMappings)) {
    if (lower.includes(taskType)) {
      for (const id of ids) {
        const integration = getIntegration(id);
        if (integration && !suggestions.find((s) => s.id === id)) {
          suggestions.push(integration);
        }
      }
    }
  }
  
  if (suggestions.length === 0) {
    return {
      message: "I can work with many different tools. What service would you like me to connect to?",
      integrations: [],
    };
  }
  
  const names = suggestions.slice(0, 3).map((s) => s.name).join(', ');
  const hasApi = suggestions.some((s) => s.hasApi);
  
  return {
    message: hasApi 
      ? `For that, I'd recommend connecting ${names}. They have great API support.`
      : `${names} would work well for this — I'll open it in your browser.`,
    integrations: suggestions.slice(0, 5),
  };
}

/**
 * Format integration list for display
 */
export function formatIntegrationList(
  integrations: IntegrationConfig[],
  options?: { 
    showStatus?: Map<string, boolean>;
    maxItems?: number;
  }
): string {
  const items = options?.maxItems 
    ? integrations.slice(0, options.maxItems) 
    : integrations;
  
  const formatted = items.map((i) => {
    const status = options?.showStatus?.get(i.id);
    const indicator = status === true ? '✓' : status === false ? '○' : '';
    return `${indicator} ${i.name}`.trim();
  });
  
  if (options?.maxItems && integrations.length > options.maxItems) {
    const remaining = integrations.length - options.maxItems;
    formatted.push(`...and ${remaining} more`);
  }
  
  return formatted.join('\n');
}

/**
 * Get help message about integration options
 */
export function getIntegrationHelpMessage(): string {
  const apiCount = getIntegrationsWithApi().length;
  const categories = Array.from(new Set(INTEGRATIONS.map((i) => i.category)));
  
  return `I can connect to ${apiCount}+ services via API, organized into: ${categories.join(', ')}.

**API Access** (fast, automatic):
- Google, Microsoft, Slack, Notion, GitHub, and many more
- Just click "Connect" and authorize

**Browser Access** (works through your browser):  
- LinkedIn, WhatsApp, Instagram, or any website
- I open it on your computer and use it just like you would

Need help setting something up? Just ask!`;
}

/**
 * Progress message during browser automation
 */
export function getBrowserProgressMessage(
  action: string,
  integrationId?: string
): string {
  const integration = integrationId ? getIntegration(integrationId) : null;
  const name = integration?.name || 'the page';
  
  const actions: Record<string, string> = {
    navigating: `Opening ${name}...`,
    loading: `Waiting for ${name} to load...`,
    logging_in: `Checking login status...`,
    interacting: `Working on it...`,
    extracting: `Reading the page...`,
    submitting: `Submitting...`,
  };
  
  return actions[action] || `Working with ${name}...`;
}

/**
 * Error message with recovery suggestion
 */
export function getErrorRecoveryMessage(
  error: string,
  integrationId?: string
): string {
  const integration = integrationId ? getIntegration(integrationId) : null;
  const name = integration?.name || 'this service';
  
  // Common error patterns
  if (/login|session|auth/i.test(error)) {
    return `Looks like you need to log into ${name}. Please sign in and let me know when you're ready.`;
  }
  
  if (/permission|access denied|403/i.test(error)) {
    return `I don't have permission for that action on ${name}. You might need to grant additional access.`;
  }
  
  if (/rate limit|too many/i.test(error)) {
    return `${name} is rate-limiting requests. Let's wait a moment and try again.`;
  }
  
  if (/network|timeout|connection/i.test(error)) {
    return `Having trouble connecting to ${name}. Is your internet connection okay?`;
  }
  
  return `Something went wrong with ${name}. Want me to try a different approach?`;
}
