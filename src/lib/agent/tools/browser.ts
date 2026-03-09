import type { ToolDefinition, AgentContext } from '../runtime';

const DO_SERVER_URL = process.env.DO_SERVER_URL || 'https://api.crackedclaw.com';
const DO_SERVER_SECRET = process.env.DO_SERVER_SECRET || '';

interface BrowserInput {
  action: 'navigate' | 'click' | 'type' | 'screenshot' | 'snapshot' | 'evaluate';
  url?: string;
  selector?: string;
  text?: string;
  script?: string;
}

async function routeToDOServer(input: BrowserInput): Promise<unknown> {
  const res = await fetch(`${DO_SERVER_URL}/tools/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DO_SERVER_SECRET}`,
    },
    body: JSON.stringify({ tool: 'browser', input }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`DO server error: ${res.status} ${await res.text()}`);
  return res.json();
}

export const browserTool: ToolDefinition = {
  name: 'browser',
  description: 'Control a browser via Playwright for web automation. Actions: navigate, click, type, screenshot, snapshot, evaluate.',
  input_schema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['navigate', 'click', 'type', 'screenshot', 'snapshot', 'evaluate'],
        description: 'Browser action to perform',
      },
      url: { type: 'string', description: 'URL to navigate to (for navigate action)' },
      selector: { type: 'string', description: 'CSS/text selector for click/type actions' },
      text: { type: 'string', description: 'Text to type (for type action)' },
      script: { type: 'string', description: 'JavaScript to evaluate (for evaluate action)' },
    },
    required: ['action'],
  },
  async execute(input: unknown, _context: AgentContext): Promise<unknown> {
    const typedInput = input as BrowserInput;

    if (DO_SERVER_SECRET) {
      return routeToDOServer(typedInput);
    }

    // Local Playwright fallback (only works in Node.js environments, not Vercel edge)
    try {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();

      try {
        switch (typedInput.action) {
          case 'navigate':
            if (!typedInput.url) throw new Error('url required for navigate');
            await page.goto(typedInput.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
            return { title: await page.title(), url: page.url() };

          case 'click':
            if (!typedInput.selector) throw new Error('selector required for click');
            await page.click(typedInput.selector);
            return { success: true };

          case 'type':
            if (!typedInput.selector || !typedInput.text) throw new Error('selector and text required for type');
            await page.fill(typedInput.selector, typedInput.text);
            return { success: true };

          case 'screenshot': {
            const buf = await page.screenshot({ type: 'png' });
            return { screenshot: buf.toString('base64'), mimeType: 'image/png' };
          }

          case 'snapshot': {
            const content = await page.content();
            return { html: content.substring(0, 50_000) };
          }

          case 'evaluate':
            if (!typedInput.script) throw new Error('script required for evaluate');
            return { result: await page.evaluate(typedInput.script) };

          default:
            throw new Error(`Unknown action: ${typedInput.action}`);
        }
      } finally {
        await browser.close();
      }
    } catch (err) {
      throw new Error(`Browser error: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};
