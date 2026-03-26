// Map integration slugs/providers to Simple Icons slug for crisp SVG logos
// See: https://simpleicons.org/ for available icons
const SIMPLE_ICONS_SLUGS: Record<string, string> = {
  google: "google",
  "google-workspace": "google",
  "google-sheets": "googlesheets",
  "google-drive": "googledrive",
  "google-calendar": "googlecalendar",
  "google-docs": "googledocs",
  gmail: "gmail",
  slack: "slack",
  notion: "notion",
  discord: "discord",
  github: "github",
  linear: "linear",
  spotify: "spotify",
  linkedin: "linkedin",
  instagram: "instagram",
  twitter: "x",
  x: "x",
  whatsapp: "whatsapp",
  tiktok: "tiktok",
  figma: "figma",
  trello: "trello",
  asana: "asana",
  jira: "jira",
  hubspot: "hubspot",
  salesforce: "salesforce",
  stripe: "stripe",
  shopify: "shopify",
  airtable: "airtable",
  dropbox: "dropbox",
  zoom: "zoom",
  teams: "microsoftteams",
  outlook: "microsoftoutlook",
  microsoft: "microsoft",
  gitlab: "gitlab",
  bitbucket: "bitbucket",
  confluence: "confluence",
  telegram: "telegram",
  signal: "signal",
  youtube: "youtube",
  twitch: "twitch",
  reddit: "reddit",
  pinterest: "pinterest",
  snapchat: "snapchat",
  medium: "medium",
  wordpress: "wordpress",
  wix: "wix",
  squarespace: "squarespace",
  webflow: "webflow",
  vercel: "vercel",
  netlify: "netlify",
  aws: "amazonwebservices",
  azure: "microsoftazure",
  gcp: "googlecloud",
  "google-cloud": "googlecloud",
  firebase: "firebase",
  supabase: "supabase",
  mongodb: "mongodb",
  postgresql: "postgresql",
  mysql: "mysql",
  redis: "redis",
  docker: "docker",
  kubernetes: "kubernetes",
  npm: "npm",
  yarn: "yarn",
  pnpm: "pnpm",
  nodejs: "nodedotjs",
  python: "python",
  rust: "rust",
  go: "go",
  typescript: "typescript",
  javascript: "javascript",
  react: "react",
  nextjs: "nextdotjs",
  vue: "vuedotjs",
  angular: "angular",
  svelte: "svelte",
  tailwind: "tailwindcss",
  openai: "openai",
  anthropic: "anthropic",
  huggingface: "huggingface",
  zapier: "zapier",
  ifttt: "ifttt",
  make: "make",
  calendly: "calendly",
  loom: "loom",
  miro: "miro",
  clickup: "clickup",
  monday: "mondaydotcom",
  basecamp: "basecamp",
  todoist: "todoist",
  evernote: "evernote",
  obsidian: "obsidian",
  1password: "1password",
  lastpass: "lastpass",
  bitwarden: "bitwarden",
  mailchimp: "mailchimp",
  sendgrid: "sendgrid",
  twilio: "twilio",
  intercom: "intercom",
  zendesk: "zendesk",
  freshdesk: "freshdesk",
  atlassian: "atlassian",
  apple: "apple",
  icloud: "icloud",
};

// Map integration slugs/providers to their domain for fallback logo lookup
const PROVIDER_DOMAINS: Record<string, string> = {
  google: "google.com",
  "google-workspace": "google.com",
  "google-sheets": "google.com",
  "google-drive": "google.com",
  "google-calendar": "google.com",
  "google-docs": "google.com",
  gmail: "gmail.com",
  slack: "slack.com",
  notion: "notion.so",
  discord: "discord.com",
  github: "github.com",
  linear: "linear.app",
  spotify: "spotify.com",
  linkedin: "linkedin.com",
  instagram: "instagram.com",
  twitter: "x.com",
  x: "x.com",
  whatsapp: "whatsapp.com",
  tiktok: "tiktok.com",
  figma: "figma.com",
  trello: "trello.com",
  asana: "asana.com",
  jira: "atlassian.com",
  hubspot: "hubspot.com",
  salesforce: "salesforce.com",
  stripe: "stripe.com",
  shopify: "shopify.com",
  airtable: "airtable.com",
  dropbox: "dropbox.com",
  zoom: "zoom.us",
  teams: "teams.microsoft.com",
  outlook: "outlook.com",
  microsoft: "microsoft.com",
  gitlab: "gitlab.com",
  bitbucket: "bitbucket.org",
  confluence: "atlassian.com",
};

/**
 * Get the Simple Icons slug for a provider, if available
 */
export function getSimpleIconsSlug(slugOrProvider: string): string | undefined {
  return SIMPLE_ICONS_SLUGS[slugOrProvider.toLowerCase()];
}

/**
 * Get the primary logo URL using Simple Icons CDN (crisp SVGs)
 * Falls back to Clearbit if no Simple Icons mapping exists
 */
export function getIntegrationLogoUrl(slugOrProvider: string, size: number = 64): string {
  const simpleIconSlug = SIMPLE_ICONS_SLUGS[slugOrProvider.toLowerCase()];
  
  if (simpleIconSlug) {
    // Use Simple Icons CDN for crisp SVG logos
    // Color: white for dark theme compatibility
    return `https://cdn.simpleicons.org/${simpleIconSlug}/white`;
  }
  
  // Fallback to Clearbit for unknown integrations
  const domain = PROVIDER_DOMAINS[slugOrProvider.toLowerCase()] || `${slugOrProvider.toLowerCase()}.com`;
  return `https://logo.clearbit.com/${domain}?size=${Math.min(size, 256)}`;
}

/**
 * Get fallback logo URL using Google favicon service at max resolution
 */
export function getIntegrationLogoFallbackUrl(slugOrProvider: string): string {
  const domain = PROVIDER_DOMAINS[slugOrProvider.toLowerCase()] || `${slugOrProvider.toLowerCase()}.com`;
  // Fallback to Google favicon at max resolution (sz=256)
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
}

/**
 * Check if a provider has a Simple Icons logo available
 */
export function hasSimpleIconsLogo(slugOrProvider: string): boolean {
  return slugOrProvider.toLowerCase() in SIMPLE_ICONS_SLUGS;
}

export function getIntegrationDomain(slugOrProvider: string): string | undefined {
  return PROVIDER_DOMAINS[slugOrProvider.toLowerCase()];
}
