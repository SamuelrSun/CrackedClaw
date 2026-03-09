// Map integration slugs/providers to their domain for logo lookup
const PROVIDER_DOMAINS: Record<string, string> = {
  google: "google.com",
  "google-workspace": "google.com",
  "google-sheets": "sheets.google.com",
  "google-drive": "drive.google.com",
  "google-calendar": "calendar.google.com",
  "google-docs": "docs.google.com",
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

export function getIntegrationLogoUrl(slugOrProvider: string, size: number = 32): string {
  const domain = PROVIDER_DOMAINS[slugOrProvider.toLowerCase()] || `${slugOrProvider.toLowerCase()}.com`;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

export function getIntegrationDomain(slugOrProvider: string): string | undefined {
  return PROVIDER_DOMAINS[slugOrProvider.toLowerCase()];
}
