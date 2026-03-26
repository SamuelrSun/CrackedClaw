// Map integration slugs/providers to their domain for Clearbit logo lookup
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
  telegram: "telegram.org",
  signal: "signal.org",
  youtube: "youtube.com",
  twitch: "twitch.tv",
  reddit: "reddit.com",
  pinterest: "pinterest.com",
  snapchat: "snapchat.com",
  medium: "medium.com",
  wordpress: "wordpress.com",
  vercel: "vercel.com",
  netlify: "netlify.com",
  aws: "aws.amazon.com",
  azure: "azure.microsoft.com",
  gcp: "cloud.google.com",
  "google-cloud": "cloud.google.com",
  firebase: "firebase.google.com",
  supabase: "supabase.com",
  openai: "openai.com",
  anthropic: "anthropic.com",
  zapier: "zapier.com",
  calendly: "calendly.com",
  loom: "loom.com",
  miro: "miro.com",
  clickup: "clickup.com",
  monday: "monday.com",
  todoist: "todoist.com",
  mailchimp: "mailchimp.com",
  sendgrid: "sendgrid.com",
  twilio: "twilio.com",
  intercom: "intercom.com",
  zendesk: "zendesk.com",
  atlassian: "atlassian.com",
  apple: "apple.com",
};

/**
 * Get the primary logo URL using Clearbit (high-res, full-color logos).
 */
export function getIntegrationLogoUrl(slugOrProvider: string, size: number = 64): string {
  const domain = PROVIDER_DOMAINS[slugOrProvider.toLowerCase()] || `${slugOrProvider.toLowerCase()}.com`;
  return `https://logo.clearbit.com/${domain}?size=${Math.min(size, 256)}`;
}

/**
 * Get fallback logo URL using Google favicon service at max resolution.
 */
export function getIntegrationLogoFallbackUrl(slugOrProvider: string): string {
  const domain = PROVIDER_DOMAINS[slugOrProvider.toLowerCase()] || `${slugOrProvider.toLowerCase()}.com`;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
}

export function getIntegrationDomain(slugOrProvider: string): string | undefined {
  return PROVIDER_DOMAINS[slugOrProvider.toLowerCase()];
}
