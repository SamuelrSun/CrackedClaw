/**
 * Integration Registry
 * Central registry of all supported integrations with their capabilities
 */

export type ApiProvider = 'maton' | 'native' | 'oauth';
export type AuthType = 'oauth' | 'browser-login' | 'api-key';

export interface IntegrationCapability {
  id: string;
  name: string;
  requiresBrowser?: boolean;  // Some capabilities only work via browser
  description?: string;
}

export interface IntegrationConfig {
  id: string;
  name: string;
  icon: string;
  hasApi: boolean;
  apiProvider?: ApiProvider;
  browserFallback: boolean;
  capabilities: string[];
  authType: AuthType;
  category: 'productivity' | 'communication' | 'social' | 'developer' | 'storage' | 'crm' | 'other';
  description?: string;
  matonKey?: string;  // Maton.ai integration key if different from id
}

/**
 * Full registry of supported integrations
 * hasApi: true = API access available (fast, reliable)
 * browserFallback: true = Can fall back to browser automation
 */
export const INTEGRATIONS: IntegrationConfig[] = [
  // === Productivity ===
  {
    id: 'google',
    name: 'Google Workspace',
    icon: 'Mail',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['gmail', 'calendar', 'drive', 'sheets', 'docs', 'meet'],
    authType: 'oauth',
    category: 'productivity',
    description: 'Email, calendar, documents, and storage',
  },
  {
    id: 'microsoft',
    name: 'Microsoft 365',
    icon: 'Mail',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['outlook', 'calendar', 'onedrive', 'teams', 'excel', 'word'],
    authType: 'oauth',
    category: 'productivity',
    description: 'Email, calendar, Office apps, and Teams',
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: 'FileText',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['pages', 'databases', 'search', 'comments'],
    authType: 'oauth',
    category: 'productivity',
    description: 'Notes, docs, and databases',
  },
  {
    id: 'airtable',
    name: 'Airtable',
    icon: 'Table',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['bases', 'records', 'views', 'automations'],
    authType: 'oauth',
    category: 'productivity',
    description: 'Spreadsheet-database hybrid',
  },
  {
    id: 'asana',
    name: 'Asana',
    icon: 'CheckSquare',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['tasks', 'projects', 'workspaces', 'portfolios'],
    authType: 'oauth',
    category: 'productivity',
    description: 'Project and task management',
  },
  {
    id: 'trello',
    name: 'Trello',
    icon: 'Layout',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['boards', 'cards', 'lists', 'labels'],
    authType: 'oauth',
    category: 'productivity',
    description: 'Kanban-style project boards',
  },
  {
    id: 'linear',
    name: 'Linear',
    icon: 'Zap',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['issues', 'projects', 'cycles', 'teams'],
    authType: 'oauth',
    category: 'productivity',
    description: 'Issue tracking for software teams',
  },
  {
    id: 'monday',
    name: 'Monday.com',
    icon: 'Grid',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['boards', 'items', 'updates', 'automations'],
    authType: 'oauth',
    category: 'productivity',
    description: 'Work operating system',
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    icon: 'CheckCircle',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['tasks', 'spaces', 'folders', 'goals'],
    authType: 'oauth',
    category: 'productivity',
    description: 'All-in-one productivity platform',
  },
  {
    id: 'todoist',
    name: 'Todoist',
    icon: 'Check',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['tasks', 'projects', 'labels', 'filters'],
    authType: 'oauth',
    category: 'productivity',
    description: 'Task management and to-do lists',
  },

  // === Communication ===
  {
    id: 'slack',
    name: 'Slack',
    icon: 'Hash',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['messages', 'channels', 'files', 'reactions', 'threads'],
    authType: 'oauth',
    category: 'communication',
    description: 'Team messaging and collaboration',
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: 'MessageCircle',
    hasApi: true,
    apiProvider: 'native',
    browserFallback: true,
    capabilities: ['messages', 'channels', 'servers', 'reactions'],
    authType: 'oauth',
    category: 'communication',
    description: 'Community and team chat',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: 'Send',
    hasApi: true,
    apiProvider: 'native',
    browserFallback: true,
    capabilities: ['messages', 'groups', 'channels', 'bots'],
    authType: 'api-key',
    category: 'communication',
    description: 'Messaging with bots — requires connected Mac node for scanning',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: 'MessageSquare',
    hasApi: false,  // No official API for personal accounts
    browserFallback: true,
    capabilities: ['messages', 'groups', 'status'],
    authType: 'browser-login',
    category: 'communication',
    description: 'Personal and business messaging — requires connected Mac node for scanning',
  },
  {
    id: 'imessage',
    name: 'iMessage',
    icon: 'MessageCircle',
    hasApi: false,
    browserFallback: false,
    capabilities: ['messages', 'contacts'],
    authType: 'browser-login',
    category: 'communication',
    description: 'Requires connected Mac node with Messages.app',
  },
  {
    id: 'zoom',
    name: 'Zoom',
    icon: 'Video',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['meetings', 'recordings', 'webinars', 'chat'],
    authType: 'oauth',
    category: 'communication',
    description: 'Video conferencing',
  },

  // === Social ===
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: 'Linkedin',
    hasApi: false,  // Limited API, browser preferred
    browserFallback: true,
    capabilities: ['search', 'messages', 'profile', 'connections', 'posts'],
    authType: 'browser-login',
    category: 'social',
    description: 'Professional networking',
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    icon: 'Twitter',
    hasApi: true,
    apiProvider: 'oauth',
    browserFallback: true,
    capabilities: ['tweets', 'dms', 'search', 'followers', 'lists'],
    authType: 'oauth',
    category: 'social',
    description: 'Social media and news',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: 'Instagram',
    hasApi: false,  // API restricted to business accounts
    browserFallback: true,
    capabilities: ['posts', 'stories', 'dms', 'followers'],
    authType: 'browser-login',
    category: 'social',
    description: 'Photo and video sharing',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: 'Facebook',
    hasApi: false,  // Limited personal API
    browserFallback: true,
    capabilities: ['posts', 'messages', 'groups', 'pages'],
    authType: 'browser-login',
    category: 'social',
    description: 'Social networking',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: 'Play',
    hasApi: false,
    browserFallback: true,
    capabilities: ['videos', 'analytics', 'comments'],
    authType: 'browser-login',
    category: 'social',
    description: 'Short-form video',
  },
  {
    id: 'reddit',
    name: 'Reddit',
    icon: 'MessageSquare',
    hasApi: true,
    apiProvider: 'oauth',
    browserFallback: true,
    capabilities: ['posts', 'comments', 'subreddits', 'messages'],
    authType: 'oauth',
    category: 'social',
    description: 'Communities and discussions',
  },

  // === Developer ===
  {
    id: 'github',
    name: 'GitHub',
    icon: 'Github',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['repos', 'issues', 'prs', 'actions', 'gists'],
    authType: 'oauth',
    category: 'developer',
    description: 'Code hosting and collaboration',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    icon: 'GitBranch',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['repos', 'issues', 'merge_requests', 'pipelines'],
    authType: 'oauth',
    category: 'developer',
    description: 'DevOps platform',
  },
  {
    id: 'jira',
    name: 'Jira',
    icon: 'Clipboard',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['issues', 'projects', 'boards', 'sprints'],
    authType: 'oauth',
    category: 'developer',
    description: 'Issue and project tracking',
  },
  {
    id: 'confluence',
    name: 'Confluence',
    icon: 'Book',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['pages', 'spaces', 'search', 'comments'],
    authType: 'oauth',
    category: 'developer',
    description: 'Team documentation',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    icon: 'Triangle',
    hasApi: true,
    apiProvider: 'oauth',
    browserFallback: true,
    capabilities: ['deployments', 'projects', 'domains', 'logs'],
    authType: 'oauth',
    category: 'developer',
    description: 'Frontend deployment',
  },

  // === Storage ===
  {
    id: 'dropbox',
    name: 'Dropbox',
    icon: 'Box',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['files', 'folders', 'sharing', 'search'],
    authType: 'oauth',
    category: 'storage',
    description: 'Cloud file storage',
  },
  {
    id: 'box',
    name: 'Box',
    icon: 'Package',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['files', 'folders', 'collaboration', 'workflows'],
    authType: 'oauth',
    category: 'storage',
    description: 'Enterprise content management',
  },

  // === CRM ===
  {
    id: 'hubspot',
    name: 'HubSpot',
    icon: 'Users',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['contacts', 'deals', 'companies', 'emails', 'marketing'],
    authType: 'oauth',
    category: 'crm',
    description: 'CRM and marketing automation',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    icon: 'Cloud',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['leads', 'contacts', 'opportunities', 'accounts', 'reports'],
    authType: 'oauth',
    category: 'crm',
    description: 'Enterprise CRM',
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    icon: 'TrendingUp',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['deals', 'contacts', 'activities', 'pipelines'],
    authType: 'oauth',
    category: 'crm',
    description: 'Sales CRM',
  },
  {
    id: 'intercom',
    name: 'Intercom',
    icon: 'MessageCircle',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['conversations', 'contacts', 'articles', 'bots'],
    authType: 'oauth',
    category: 'crm',
    description: 'Customer messaging',
  },
  {
    id: 'zendesk',
    name: 'Zendesk',
    icon: 'Headphones',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['tickets', 'users', 'organizations', 'articles'],
    authType: 'oauth',
    category: 'crm',
    description: 'Customer support',
  },

  // === Design ===
  {
    id: 'figma',
    name: 'Figma',
    icon: 'Figma',
    hasApi: true,
    apiProvider: 'oauth',
    browserFallback: true,
    capabilities: ['files', 'projects', 'comments', 'components'],
    authType: 'oauth',
    category: 'other',
    description: 'Collaborative design and prototyping',
  },

    // === Other ===
  {
    id: 'stripe',
    name: 'Stripe',
    icon: 'CreditCard',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: false,  // Too sensitive for browser
    capabilities: ['payments', 'customers', 'subscriptions', 'invoices'],
    authType: 'api-key',
    category: 'other',
    description: 'Payments and billing',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    icon: 'ShoppingBag',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['orders', 'products', 'customers', 'inventory'],
    authType: 'oauth',
    category: 'other',
    description: 'E-commerce platform',
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    icon: 'Mail',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: true,
    capabilities: ['campaigns', 'lists', 'templates', 'automations'],
    authType: 'oauth',
    category: 'other',
    description: 'Email marketing',
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    icon: 'Send',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: false,
    capabilities: ['emails', 'templates', 'contacts', 'analytics'],
    authType: 'api-key',
    category: 'other',
    description: 'Transactional email',
  },
  {
    id: 'twilio',
    name: 'Twilio',
    icon: 'Phone',
    hasApi: true,
    apiProvider: 'maton',
    browserFallback: false,
    capabilities: ['sms', 'calls', 'verify', 'conversations'],
    authType: 'api-key',
    category: 'other',
    description: 'Communication APIs',
  },
];

// Helper functions for registry access
export function getIntegration(id: string): IntegrationConfig | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}

export function getIntegrationsByCategory(category: IntegrationConfig['category']): IntegrationConfig[] {
  return INTEGRATIONS.filter((i) => i.category === category);
}

export function getIntegrationsWithApi(): IntegrationConfig[] {
  return INTEGRATIONS.filter((i) => i.hasApi);
}

export function getIntegrationsWithBrowserOnly(): IntegrationConfig[] {
  return INTEGRATIONS.filter((i) => !i.hasApi && i.browserFallback);
}

export function getIntegrationByCapability(capability: string): IntegrationConfig | undefined {
  return INTEGRATIONS.find((i) => i.capabilities.includes(capability));
}

export function getAllCapabilities(): string[] {
  const caps = new Set<string>();
  for (const integration of INTEGRATIONS) {
    for (const cap of integration.capabilities) {
      caps.add(cap);
    }
  }
  return Array.from(caps);
}

export function searchIntegrations(query: string): IntegrationConfig[] {
  const lower = query.toLowerCase();
  return INTEGRATIONS.filter(
    (i) =>
      i.name.toLowerCase().includes(lower) ||
      i.id.toLowerCase().includes(lower) ||
      i.capabilities.some((c) => c.toLowerCase().includes(lower)) ||
      i.description?.toLowerCase().includes(lower)
  );
}

// Category metadata
export const CATEGORIES = {
  productivity: { name: 'Productivity', icon: 'Briefcase', order: 1 },
  communication: { name: 'Communication', icon: 'MessageCircle', order: 2 },
  social: { name: 'Social', icon: 'Users', order: 3 },
  developer: { name: 'Developer', icon: 'Code', order: 4 },
  storage: { name: 'Storage', icon: 'HardDrive', order: 5 },
  crm: { name: 'CRM', icon: 'UserCheck', order: 6 },
  other: { name: 'Other', icon: 'MoreHorizontal', order: 7 },
} as const;
