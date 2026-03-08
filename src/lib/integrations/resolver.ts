/**
 * Dynamic Integration Resolver
 * Resolves ANY service name -> structured integration config.
 * Registry = fast path. Extended map = known-but-unlisted services.
 * Unknown services default to browser-gated.
 */

import { getIntegration, INTEGRATIONS } from './registry';

export interface ResolvedIntegration {
  name: string;
  slug: string;
  icon: string;
  authType: 'oauth' | 'api_key' | 'browser' | 'hybrid';
  needsNode: boolean;
  oauthScopes?: string[];
  apiKeyLabel?: string;
  loginUrl?: string;
  category: string;
  description: string;
  capabilities: string[];
  knownService: boolean;
}

// Extended known services map
const KNOWN_SERVICES: Record<string, Partial<ResolvedIntegration>> = {
  attio: { name: 'Attio', icon: '🟣', authType: 'oauth', category: 'crm', description: 'Modern CRM', capabilities: ['contacts', 'deals', 'notes'] },
  close: { name: 'Close', icon: '🔵', authType: 'api_key', apiKeyLabel: 'API Key', category: 'crm', description: 'Sales CRM with calling', capabilities: ['leads', 'contacts', 'calls'] },
  coda: { name: 'Coda', icon: '📄', authType: 'api_key', apiKeyLabel: 'API Token', category: 'productivity', description: 'Docs that do anything', capabilities: ['docs', 'tables', 'automations'] },
  loom: { name: 'Loom', icon: '🎥', authType: 'oauth', category: 'communication', description: 'Video messaging', capabilities: ['videos', 'spaces'] },
  calendly: { name: 'Calendly', icon: '📅', authType: 'oauth', category: 'productivity', description: 'Scheduling automation', capabilities: ['events', 'scheduling'] },
  linear: { name: 'Linear', icon: '⚡', authType: 'oauth', category: 'developer', description: 'Issue tracking', capabilities: ['issues', 'projects', 'cycles'] },
  shortcut: { name: 'Shortcut', icon: '📖', authType: 'api_key', apiKeyLabel: 'API Token', category: 'developer', description: 'Project management', capabilities: ['stories', 'epics', 'sprints'] },
  supabase: { name: 'Supabase', icon: '⚡', authType: 'api_key', apiKeyLabel: 'Service Key', category: 'developer', description: 'Open-source Firebase', capabilities: ['database', 'auth', 'storage'] },
  railway: { name: 'Railway', icon: '🚂', authType: 'api_key', apiKeyLabel: 'API Token', category: 'developer', description: 'App deployment', capabilities: ['deployments', 'services'] },
  sentry: { name: 'Sentry', icon: '🔭', authType: 'oauth', category: 'developer', description: 'Error tracking', capabilities: ['issues', 'projects', 'releases'] },
  datadog: { name: 'Datadog', icon: '🐕', authType: 'api_key', apiKeyLabel: 'API Key', category: 'developer', description: 'Monitoring', capabilities: ['metrics', 'logs', 'traces'] },
  amplitude: { name: 'Amplitude', icon: '📈', authType: 'api_key', apiKeyLabel: 'API Key', category: 'other', description: 'Product analytics', capabilities: ['events', 'cohorts', 'funnels'] },
  mixpanel: { name: 'Mixpanel', icon: '📊', authType: 'api_key', apiKeyLabel: 'Service Account', category: 'other', description: 'Product analytics', capabilities: ['events', 'funnels', 'reports'] },
  posthog: { name: 'PostHog', icon: '🦔', authType: 'api_key', apiKeyLabel: 'API Key', category: 'other', description: 'Open-source analytics', capabilities: ['events', 'recordings', 'feature_flags'] },
  segment: { name: 'Segment', icon: '⬡', authType: 'api_key', apiKeyLabel: 'Write Key', category: 'other', description: 'Customer data platform', capabilities: ['events', 'sources', 'destinations'] },
  klaviyo: { name: 'Klaviyo', icon: '📮', authType: 'api_key', apiKeyLabel: 'Private API Key', category: 'other', description: 'Email & SMS marketing', capabilities: ['campaigns', 'flows', 'lists'] },
  webflow: { name: 'Webflow', icon: '🌊', authType: 'oauth', category: 'other', description: 'Visual web development', capabilities: ['sites', 'collections', 'cms'] },
  xero: { name: 'Xero', icon: '💹', authType: 'oauth', category: 'other', description: 'Cloud accounting', capabilities: ['invoices', 'bills', 'contacts'] },
  quickbooks: { name: 'QuickBooks', icon: '💰', authType: 'oauth', category: 'other', description: 'Accounting', capabilities: ['invoices', 'expenses', 'reports'] },
  openai: { name: 'OpenAI', icon: '🤖', authType: 'api_key', apiKeyLabel: 'API Key', category: 'developer', description: 'GPT & DALL-E', capabilities: ['completions', 'embeddings', 'images'] },
  pinecone: { name: 'Pinecone', icon: '🌲', authType: 'api_key', apiKeyLabel: 'API Key', category: 'developer', description: 'Vector database', capabilities: ['indexes', 'vectors', 'search'] },
  replicate: { name: 'Replicate', icon: '🔁', authType: 'api_key', apiKeyLabel: 'API Token', category: 'developer', description: 'Run AI models', capabilities: ['predictions', 'models'] },
  linkedin: { name: 'LinkedIn', icon: '💼', authType: 'browser', needsNode: true, loginUrl: 'https://linkedin.com', category: 'social', description: 'Professional networking', capabilities: ['search', 'messages', 'connections'] },
  instagram: { name: 'Instagram', icon: '📸', authType: 'browser', needsNode: true, loginUrl: 'https://instagram.com', category: 'social', description: 'Photo & video sharing', capabilities: ['posts', 'stories', 'dms'] },
  facebook: { name: 'Facebook', icon: '👤', authType: 'browser', needsNode: true, loginUrl: 'https://facebook.com', category: 'social', description: 'Social networking', capabilities: ['posts', 'messages', 'groups'] },
  tiktok: { name: 'TikTok', icon: '🎵', authType: 'browser', needsNode: true, loginUrl: 'https://tiktok.com', category: 'social', description: 'Short-form video', capabilities: ['videos', 'analytics'] },
  whatsapp: { name: 'WhatsApp', icon: '💬', authType: 'browser', needsNode: true, loginUrl: 'https://web.whatsapp.com', category: 'communication', description: 'Messaging', capabilities: ['messages', 'groups'] },
  discord: { name: 'Discord', icon: '🎮', authType: 'oauth', category: 'communication', description: 'Community chat', capabilities: ['messages', 'channels', 'servers'] },
  front: { name: 'Front', icon: '📬', authType: 'oauth', category: 'communication', description: 'Collaborative inbox', capabilities: ['conversations', 'contacts'] },
  basecamp: { name: 'Basecamp', icon: '⛺', authType: 'oauth', category: 'productivity', description: 'Project & team management', capabilities: ['projects', 'messages', 'todos'] },
  copper: { name: 'Copper', icon: '🟠', authType: 'oauth', category: 'crm', description: 'Google-native CRM', capabilities: ['contacts', 'opportunities'] },
  height: { name: 'Height', icon: '📐', authType: 'oauth', category: 'productivity', description: 'Project management', capabilities: ['tasks', 'projects'] },
  notion: { name: 'Notion', icon: '📝', authType: 'oauth', category: 'productivity', description: 'Docs & databases', capabilities: ['pages', 'databases', 'search'] },
  figma: { name: 'Figma', icon: '🎨', authType: 'oauth', category: 'developer', description: 'Collaborative design', capabilities: ['files', 'comments', 'components'] },
  vercel: { name: 'Vercel', icon: '▲', authType: 'oauth', category: 'developer', description: 'Frontend deployment', capabilities: ['deployments', 'projects', 'domains'] },
  render: { name: 'Render', icon: '🎨', authType: 'api_key', apiKeyLabel: 'API Key', category: 'developer', description: 'Cloud platform', capabilities: ['services', 'deployments'] },
  neon: { name: 'Neon', icon: '💚', authType: 'api_key', apiKeyLabel: 'API Key', category: 'developer', description: 'Serverless Postgres', capabilities: ['databases', 'branches'] },
  mercury: { name: 'Mercury', icon: '🏦', authType: 'api_key', apiKeyLabel: 'API Key', category: 'other', description: 'Startup banking', capabilities: ['accounts', 'transactions'] },
  customerio: { name: 'Customer.io', icon: '📨', authType: 'api_key', apiKeyLabel: 'API Key', category: 'crm', description: 'Behavioral email marketing', capabilities: ['campaigns', 'segments'] },
};

const BROWSER_ONLY_SLUGS = ['linkedin', 'instagram', 'facebook', 'tiktok', 'whatsapp', 'snapchat', 'pinterest'];

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function guessIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('mail') || lower.includes('email')) return '📧';
  if (lower.includes('calendar') || lower.includes('schedule')) return '📅';
  if (lower.includes('doc') || lower.includes('note') || lower.includes('sheet')) return '📄';
  if (lower.includes('video') || lower.includes('meet') || lower.includes('zoom')) return '🎥';
  if (lower.includes('code') || lower.includes('git') || lower.includes('dev')) return '💻';
  if (lower.includes('chat') || lower.includes('message') || lower.includes('slack')) return '💬';
  if (lower.includes('crm') || lower.includes('sales') || lower.includes('customer')) return '🤝';
  if (lower.includes('pay') || lower.includes('stripe') || lower.includes('money')) return '💰';
  if (lower.includes('analytics') || lower.includes('data') || lower.includes('metric')) return '📈';
  return '🔌';
}

export function resolveIntegration(serviceName: string): ResolvedIntegration {
  const slug = toSlug(serviceName);
  const lower = serviceName.toLowerCase();

  // 1. Main registry
  const registered = getIntegration(slug) || INTEGRATIONS.find(i => i.name.toLowerCase() === lower);
  if (registered) {
    // Map registry AuthType to resolver AuthType (registry uses dashes, resolver uses underscores)
    let authType: ResolvedIntegration['authType'] = 'oauth';
    if (registered.authType === 'browser-login') authType = 'browser';
    else if (registered.authType === 'api-key') authType = 'api_key';
    else if (registered.authType === 'oauth') authType = 'oauth';

    return {
      name: registered.name,
      slug: registered.id,
      icon: guessIcon(registered.name),
      authType,
      needsNode: !registered.hasApi && registered.browserFallback,
      oauthScopes: [],
      category: registered.category,
      description: registered.description || '',
      capabilities: registered.capabilities,
      knownService: true,
    };
  }

  // 2. Extended map
  const known = KNOWN_SERVICES[slug];
  if (known) {
    return {
      name: known.name || serviceName,
      slug,
      icon: known.icon || guessIcon(serviceName),
      authType: known.authType || 'oauth',
      needsNode: known.needsNode || false,
      oauthScopes: known.oauthScopes,
      apiKeyLabel: known.apiKeyLabel,
      loginUrl: known.loginUrl,
      category: known.category || 'other',
      description: known.description || `Connect to ${serviceName}`,
      capabilities: known.capabilities || [],
      knownService: true,
    };
  }

  // 3. Browser-only heuristic
  const isBrowserOnly = BROWSER_ONLY_SLUGS.some(d => slug.includes(d));

  // 4. Unknown service - best-guess
  return {
    name: serviceName.charAt(0).toUpperCase() + serviceName.slice(1),
    slug,
    icon: guessIcon(serviceName),
    authType: isBrowserOnly ? 'browser' : 'oauth',
    needsNode: isBrowserOnly,
    loginUrl: isBrowserOnly ? `https://${slug}.com` : undefined,
    category: 'other',
    description: `Connect to ${serviceName}`,
    capabilities: [],
    knownService: false,
  };
}

export function parseServicesFromText(text: string): string[] {
  const cleaned = text
    .replace(/\b(i use|we use|our team uses|i'm using|also|plus|as well as|for my|for our|for the|which is|such as|like|including|connect|add|integrate|integration with|integrate with)\b/gi, ',')
    .replace(/[()[\]]/g, ',');

  const parts = cleaned.split(/[,;\n]+/);
  const stopWords = new Set(['a', 'an', 'the', 'my', 'our', 'to', 'with', 'in', 'on', 'at', 'by', 'of', 'is', 'are', 'and', 'or', 'it']);

  const services: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim().replace(/[^a-zA-Z0-9\s\-_.]/g, '').trim();
    if (!trimmed || trimmed.length < 2 || trimmed.length > 40) continue;
    const first = trimmed.split(/\s+/)[0].toLowerCase();
    if (stopWords.has(first)) continue;
    services.push(trimmed);
  }
  return Array.from(new Set(services));
}

export function resolveFromText(text: string): ResolvedIntegration[] {
  return parseServicesFromText(text).map(s => resolveIntegration(s));
}
