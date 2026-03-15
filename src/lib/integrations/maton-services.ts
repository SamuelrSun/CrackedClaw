/**
 * Maton API Gateway — supported services reference
 * Source: api-gateway skill from ClawHub (byungkyu/api-gateway)
 * These services support OAuth via Maton's create-connection endpoint
 */

export const MATON_SERVICES: Record<string, { name: string; category: string; capabilities: string[] }> = {
  // Productivity
  'google-mail': { name: 'Gmail', category: 'productivity', capabilities: ['email', 'labels', 'drafts', 'attachments'] },
  'google-calendar': { name: 'Google Calendar', category: 'productivity', capabilities: ['events', 'calendars', 'reminders'] },
  'google-drive': { name: 'Google Drive', category: 'productivity', capabilities: ['files', 'folders', 'sharing', 'search'] },
  'google-sheets': { name: 'Google Sheets', category: 'productivity', capabilities: ['spreadsheets', 'cells', 'charts'] },
  'google-docs': { name: 'Google Docs', category: 'productivity', capabilities: ['documents', 'comments', 'suggestions'] },
  'google-contacts': { name: 'Google Contacts', category: 'productivity', capabilities: ['contacts', 'groups'] },
  'google-meet': { name: 'Google Meet', category: 'productivity', capabilities: ['meetings', 'recordings'] },
  'google-forms': { name: 'Google Forms', category: 'productivity', capabilities: ['forms', 'responses'] },
  'google-ads': { name: 'Google Ads', category: 'productivity', capabilities: ['campaigns', 'ads', 'analytics'] },
  'google-analytics': { name: 'Google Analytics', category: 'productivity', capabilities: ['reports', 'metrics'] },
  'notion': { name: 'Notion', category: 'productivity', capabilities: ['pages', 'databases', 'search', 'blocks'] },
  'todoist': { name: 'Todoist', category: 'productivity', capabilities: ['tasks', 'projects', 'labels'] },
  'airtable': { name: 'Airtable', category: 'productivity', capabilities: ['bases', 'records', 'views'] },
  'clickup': { name: 'ClickUp', category: 'productivity', capabilities: ['tasks', 'spaces', 'folders', 'goals'] },
  'asana': { name: 'Asana', category: 'productivity', capabilities: ['tasks', 'projects', 'workspaces'] },
  'monday': { name: 'Monday.com', category: 'productivity', capabilities: ['boards', 'items', 'updates'] },
  'trello': { name: 'Trello', category: 'productivity', capabilities: ['boards', 'cards', 'lists'] },
  'calendly': { name: 'Calendly', category: 'productivity', capabilities: ['events', 'scheduling'] },

  // Communication
  'slack': { name: 'Slack', category: 'communication', capabilities: ['messages', 'channels', 'files', 'reactions'] },
  'discord': { name: 'Discord', category: 'communication', capabilities: ['messages', 'channels', 'servers'] },
  'zoom': { name: 'Zoom', category: 'communication', capabilities: ['meetings', 'recordings', 'webinars'] },
  'microsoft-teams': { name: 'Microsoft Teams', category: 'communication', capabilities: ['messages', 'channels', 'meetings'] },
  'telegram': { name: 'Telegram', category: 'communication', capabilities: ['messages', 'bots', 'groups'] },
  'whatsapp-business': { name: 'WhatsApp Business', category: 'communication', capabilities: ['messages', 'templates'] },
  'sendgrid': { name: 'SendGrid', category: 'communication', capabilities: ['emails', 'templates', 'contacts'] },
  'mailchimp': { name: 'Mailchimp', category: 'communication', capabilities: ['campaigns', 'lists', 'templates'] },
  'mailgun': { name: 'Mailgun', category: 'communication', capabilities: ['emails', 'routes', 'lists'] },

  // Developer
  'github': { name: 'GitHub', category: 'developer', capabilities: ['repos', 'issues', 'prs', 'actions', 'gists'] },
  'gitlab': { name: 'GitLab', category: 'developer', capabilities: ['repos', 'issues', 'merge_requests', 'pipelines'] },
  'jira': { name: 'Jira', category: 'developer', capabilities: ['issues', 'projects', 'boards', 'sprints'] },
  'confluence': { name: 'Confluence', category: 'developer', capabilities: ['pages', 'spaces', 'search'] },
  'linear': { name: 'Linear', category: 'developer', capabilities: ['issues', 'projects', 'cycles'] },
  'sentry': { name: 'Sentry', category: 'developer', capabilities: ['issues', 'projects', 'releases'] },

  // CRM & Sales
  'hubspot': { name: 'HubSpot', category: 'crm', capabilities: ['contacts', 'deals', 'companies', 'emails'] },
  'salesforce': { name: 'Salesforce', category: 'crm', capabilities: ['leads', 'contacts', 'opportunities'] },
  'pipedrive': { name: 'Pipedrive', category: 'crm', capabilities: ['deals', 'contacts', 'activities'] },
  'intercom': { name: 'Intercom', category: 'crm', capabilities: ['conversations', 'contacts', 'articles'] },
  'zendesk': { name: 'Zendesk', category: 'crm', capabilities: ['tickets', 'users', 'organizations'] },
  'freshdesk': { name: 'Freshdesk', category: 'crm', capabilities: ['tickets', 'contacts', 'agents'] },

  // Finance
  'stripe': { name: 'Stripe', category: 'finance', capabilities: ['payments', 'customers', 'subscriptions'] },
  'quickbooks': { name: 'QuickBooks', category: 'finance', capabilities: ['invoices', 'expenses', 'reports'] },
  'xero': { name: 'Xero', category: 'finance', capabilities: ['invoices', 'bills', 'contacts'] },
  'square': { name: 'Square', category: 'finance', capabilities: ['payments', 'orders', 'catalog'] },

  // Storage
  'dropbox': { name: 'Dropbox', category: 'storage', capabilities: ['files', 'folders', 'sharing'] },
  'box': { name: 'Box', category: 'storage', capabilities: ['files', 'folders', 'collaboration'] },
  'microsoft-onedrive': { name: 'OneDrive', category: 'storage', capabilities: ['files', 'folders', 'sharing'] },

  // Social (limited API — browser fallback recommended for most actions)
  'linkedin': { name: 'LinkedIn', category: 'social', capabilities: ['profile', 'posts', 'ads'] },
  'twitter': { name: 'Twitter/X', category: 'social', capabilities: ['tweets', 'search', 'users'] },
  'instagram-business': { name: 'Instagram Business', category: 'social', capabilities: ['posts', 'insights'] },
  'facebook-pages': { name: 'Facebook Pages', category: 'social', capabilities: ['posts', 'insights', 'messages'] },
  'reddit': { name: 'Reddit', category: 'social', capabilities: ['posts', 'comments', 'subreddits'] },
  'youtube': { name: 'YouTube', category: 'social', capabilities: ['videos', 'channels', 'playlists'] },
  'pinterest': { name: 'Pinterest', category: 'social', capabilities: ['pins', 'boards'] },
  'tiktok-business': { name: 'TikTok Business', category: 'social', capabilities: ['videos', 'analytics'] },

  // E-commerce
  'shopify': { name: 'Shopify', category: 'ecommerce', capabilities: ['products', 'orders', 'customers'] },
  'woocommerce': { name: 'WooCommerce', category: 'ecommerce', capabilities: ['products', 'orders'] },

  // Design
  'figma': { name: 'Figma', category: 'design', capabilities: ['files', 'projects', 'comments'] },
  'canva': { name: 'Canva', category: 'design', capabilities: ['designs', 'templates'] },

  // Other
  'spotify': { name: 'Spotify', category: 'entertainment', capabilities: ['playlists', 'tracks', 'playback'] },
  'twilio': { name: 'Twilio', category: 'communication', capabilities: ['sms', 'calls', 'verify'] },
  'typeform': { name: 'Typeform', category: 'productivity', capabilities: ['forms', 'responses'] },
  'docusign': { name: 'DocuSign', category: 'productivity', capabilities: ['envelopes', 'templates', 'signing'] },

  // MCP Services (via Maton MCP proxy)
  'granola-mcp': { name: 'Granola', category: 'productivity', capabilities: ['meetings', 'transcripts', 'notes', 'action-items'] },
};

export function isMatonSupported(serviceSlug: string): boolean {
  return serviceSlug in MATON_SERVICES;
}

export function getMatonService(serviceSlug: string) {
  return MATON_SERVICES[serviceSlug] || null;
}

export function searchMatonServices(query: string): Array<{ slug: string } & typeof MATON_SERVICES[string]> {
  const lower = query.toLowerCase();
  return Object.entries(MATON_SERVICES)
    .filter(([slug, svc]) =>
      slug.includes(lower) ||
      svc.name.toLowerCase().includes(lower) ||
      svc.capabilities.some(c => c.toLowerCase().includes(lower))
    )
    .map(([slug, svc]) => ({ slug, ...svc }));
}
