import { createClient } from '@/lib/supabase/server';
import type { ToolDefinition, AgentContext } from '../runtime';

async function getIntegrationTokens(userId: string, provider: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_integrations')
    .select('access_token, refresh_token, metadata')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('status', 'connected')
    .single();
  return data;
}

// --- Send Email ---

interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  provider?: 'google' | 'microsoft';
}

export const sendEmailTool: ToolDefinition = {
  name: 'send_email',
  description: 'Send an email via the user\'s connected Gmail or Microsoft account.',
  input_schema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Email body (plain text or HTML)' },
      provider: { type: 'string', enum: ['google', 'microsoft'], description: 'Email provider (default: google)' },
    },
    required: ['to', 'subject', 'body'],
  },
  async execute(input: unknown, context: AgentContext): Promise<unknown> {
    const { to, subject, body, provider = 'google' } = input as SendEmailInput;
    const tokens = await getIntegrationTokens(context.userId, provider);
    if (!tokens?.access_token) throw new Error(`No ${provider} integration connected`);

    if (provider === 'google') {
      const message = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        body,
      ].join('\r\n');
      const encoded = Buffer.from(message).toString('base64url');
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encoded }),
      });
      if (!res.ok) throw new Error(`Gmail error: ${res.status} ${await res.text()}`);
      const data = await res.json();
      return { success: true, messageId: data.id };
    }

    if (provider === 'microsoft') {
      const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: 'Text', content: body },
            toRecipients: [{ emailAddress: { address: to } }],
          },
        }),
      });
      if (!res.ok) throw new Error(`Microsoft error: ${res.status} ${await res.text()}`);
      return { success: true };
    }

    throw new Error(`Unsupported provider: ${provider}`);
  },
};

// --- Read Calendar ---

interface ReadCalendarInput {
  provider?: 'google' | 'microsoft';
  maxResults?: number;
  timeMin?: string;
  timeMax?: string;
}

export const readCalendarTool: ToolDefinition = {
  name: 'read_calendar',
  description: 'Read upcoming calendar events from the user\'s connected Google or Microsoft calendar.',
  input_schema: {
    type: 'object',
    properties: {
      provider: { type: 'string', enum: ['google', 'microsoft'], description: 'Calendar provider' },
      maxResults: { type: 'number', description: 'Max events to return (default 10)' },
      timeMin: { type: 'string', description: 'Start time ISO8601 (default now)' },
      timeMax: { type: 'string', description: 'End time ISO8601' },
    },
  },
  async execute(input: unknown, context: AgentContext): Promise<unknown> {
    const { provider = 'google', maxResults = 10, timeMin, timeMax } = input as ReadCalendarInput;
    const tokens = await getIntegrationTokens(context.userId, provider);
    if (!tokens?.access_token) throw new Error(`No ${provider} integration connected`);

    const now = new Date().toISOString();

    if (provider === 'google') {
      const params = new URLSearchParams({
        maxResults: String(maxResults),
        orderBy: 'startTime',
        singleEvents: 'true',
        timeMin: timeMin ?? now,
        ...(timeMax ? { timeMax } : {}),
      });
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!res.ok) throw new Error(`Google Calendar error: ${res.status}`);
      const data = await res.json();
      return {
        events: (data.items ?? []).map((e: { summary: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string }; location?: string }) => ({
          title: e.summary,
          start: e.start?.dateTime ?? e.start?.date,
          end: e.end?.dateTime ?? e.end?.date,
          location: e.location,
        })),
      };
    }

    if (provider === 'microsoft') {
      const params = new URLSearchParams({
        $top: String(maxResults),
        $orderby: 'start/dateTime',
        $filter: `start/dateTime ge '${timeMin ?? now}'`,
      });
      const res = await fetch(`https://graph.microsoft.com/v1.0/me/events?${params}`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!res.ok) throw new Error(`Microsoft Calendar error: ${res.status}`);
      const data = await res.json();
      return {
        events: (data.value ?? []).map((e: { subject: string; start: { dateTime: string }; end: { dateTime: string }; location?: { displayName?: string } }) => ({
          title: e.subject,
          start: e.start?.dateTime,
          end: e.end?.dateTime,
          location: e.location?.displayName,
        })),
      };
    }

    throw new Error(`Unsupported provider: ${provider}`);
  },
};

// --- Create Calendar Event ---

interface CreateEventInput {
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  provider?: 'google' | 'microsoft';
}

export const createEventTool: ToolDefinition = {
  name: 'create_event',
  description: 'Create a calendar event in the user\'s connected Google or Microsoft calendar.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Event title' },
      start: { type: 'string', description: 'Start time ISO8601' },
      end: { type: 'string', description: 'End time ISO8601' },
      description: { type: 'string', description: 'Event description' },
      location: { type: 'string', description: 'Event location' },
      provider: { type: 'string', enum: ['google', 'microsoft'] },
    },
    required: ['title', 'start', 'end'],
  },
  async execute(input: unknown, context: AgentContext): Promise<unknown> {
    const { title, start, end, description, location, provider = 'google' } = input as CreateEventInput;
    const tokens = await getIntegrationTokens(context.userId, provider);
    if (!tokens?.access_token) throw new Error(`No ${provider} integration connected`);

    if (provider === 'google') {
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: title,
          description,
          location,
          start: { dateTime: start },
          end: { dateTime: end },
        }),
      });
      if (!res.ok) throw new Error(`Google Calendar error: ${res.status}`);
      const data = await res.json();
      return { success: true, eventId: data.id, htmlLink: data.htmlLink };
    }

    if (provider === 'microsoft') {
      const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: title,
          body: { contentType: 'Text', content: description ?? '' },
          location: { displayName: location ?? '' },
          start: { dateTime: start, timeZone: 'UTC' },
          end: { dateTime: end, timeZone: 'UTC' },
        }),
      });
      if (!res.ok) throw new Error(`Microsoft Calendar error: ${res.status}`);
      const data = await res.json();
      return { success: true, eventId: data.id };
    }

    throw new Error(`Unsupported provider: ${provider}`);
  },
};

export const calendarTools = [readCalendarTool, createEventTool];
