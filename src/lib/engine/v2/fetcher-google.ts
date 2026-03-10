/**
 * Google Workspace Fetcher
 * Fetches Gmail, Calendar, Drive, and Contacts data
 */

import { createClient } from '@supabase/supabase-js';
import type { IntegrationFetcher, IntegrationRawData, DataSection, DataItem, ScanMode, ScanProgressCallback } from './types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getGoogleToken(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_integrations')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('status', 'connected')
    .single();
  if (!data?.access_token) return null;

  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;
  if (expiresAt && expiresAt - Date.now() < 5 * 60 * 1000 && data.refresh_token) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: data.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    if (res.ok) {
      const refreshed = await res.json();
      await supabase.from('user_integrations').update({
        access_token: refreshed.access_token,
        token_expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
      }).eq('user_id', userId).eq('provider', 'google');
      return refreshed.access_token;
    }
  }
  return data.access_token;
}

async function gapi(token: string, url: string): Promise<any> {
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!res.ok) throw new Error('Google API ' + res.status + ': ' + (await res.text()).substring(0, 200));
  return res.json();
}

function extractPlainBody(payload: any): string {
  let body = '';
  function walk(part: any) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body = Buffer.from(part.body.data, 'base64').toString('utf-8');
    }
    if (part.parts) part.parts.forEach(walk);
  }
  if (payload) walk(payload);
  return body.substring(0, 800); // Trim for token efficiency
}

function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  return headers?.find((h: { name: string; value: string }) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

export const googleFetcher: IntegrationFetcher = {
  provider: 'google',

  async fetch(userId: string, mode: ScanMode, onProgress?: ScanProgressCallback): Promise<IntegrationRawData> {
    const token = await getGoogleToken(userId);
    if (!token) throw new Error('No Google integration connected. Please connect Google Workspace first.');

    const maxSent = mode === 'quick' ? 25 : 150;
    const maxReceived = mode === 'quick' ? 30 : 200;
    const calDaysBack = mode === 'quick' ? 14 : 90;
    const calDaysForward = mode === 'quick' ? 14 : 30;
    const maxDriveFiles = mode === 'quick' ? 20 : 50;

    const sections: DataSection[] = [];

    // ── Gmail Profile ──
    onProgress?.({ phase: 'fetching', provider: 'google', progress: 5, message: 'Connecting to Gmail...', log: '### 📧 Connecting to Gmail...' });
    const profile = await gapi(token, 'https://gmail.googleapis.com/gmail/v1/users/me/profile');

    // ── Sent Emails ──
    onProgress?.({ phase: 'fetching', provider: 'google', progress: 10, message: 'Fetching sent emails...', log: '### 📤 Fetching up to ' + maxSent + ' sent emails...' });
    const sentItems: DataItem[] = [];
    let sentPageToken = '';
    let sentFetched = 0;
    while (sentFetched < maxSent) {
      const batch = Math.min(maxSent - sentFetched, 50);
      let url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=' + batch + '&q=in:sent';
      if (sentPageToken) url += '&pageToken=' + sentPageToken;
      const list = await gapi(token, url);
      if (!list.messages?.length) break;

      // Fetch details in parallel batches of 5
      for (let i = 0; i < list.messages.length; i += 5) {
        const msgBatch = list.messages.slice(i, i + 5);
        const details = await Promise.all(msgBatch.map(async (m: { id: string }) => {
          try {
            return await gapi(token, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + m.id + '?format=full');
          } catch { return null; }
        }));
        for (const d of details) {
          if (!d) continue;
          const headers = d.payload?.headers || [];
          sentItems.push({
            title: getHeader(headers, 'Subject') || '(no subject)',
            subtitle: 'To: ' + (getHeader(headers, 'To') || 'unknown'),
            date: getHeader(headers, 'Date'),
            body: extractPlainBody(d.payload),
            metadata: { threadId: d.threadId, labels: d.labelIds, isReply: !!getHeader(headers, 'In-Reply-To') },
          });
        }
      }
      sentFetched = sentItems.length;
      sentPageToken = list.nextPageToken || '';
      if (!sentPageToken) break;
    }

    const sentLog = sentItems.slice(0, 8).map(e => '- **' + e.title + '** → ' + (e.subtitle || '')).join('\n');
    onProgress?.({ phase: 'fetching', provider: 'google', progress: 30, message: sentItems.length + ' sent emails fetched', log: '### ✅ ' + sentItems.length + ' sent emails fetched\n' + sentLog + (sentItems.length > 8 ? '\n- _...and ' + (sentItems.length - 8) + ' more_' : '') });

    sections.push({ name: 'sent_emails', description: 'Emails sent by the user', items: sentItems, totalAvailable: sentItems.length });

    // ── Received Emails (metadata only) ──
    onProgress?.({ phase: 'fetching', provider: 'google', progress: 35, message: 'Fetching received emails...', log: '### 📥 Fetching up to ' + maxReceived + ' received email headers...' });
    const receivedItems: DataItem[] = [];
    let recvPageToken = '';
    let recvFetched = 0;
    while (recvFetched < maxReceived) {
      const batch = Math.min(maxReceived - recvFetched, 50);
      let url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=' + batch + '&q=in:inbox -in:sent';
      if (recvPageToken) url += '&pageToken=' + recvPageToken;
      const list = await gapi(token, url);
      if (!list.messages?.length) break;

      for (let i = 0; i < list.messages.length; i += 10) {
        const msgBatch = list.messages.slice(i, i + 10);
        const details = await Promise.all(msgBatch.map(async (m: { id: string }) => {
          try {
            return await gapi(token, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/' + m.id + '?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date');
          } catch { return null; }
        }));
        for (const d of details) {
          if (!d) continue;
          const headers = d.payload?.headers || [];
          receivedItems.push({
            title: getHeader(headers, 'Subject') || '(no subject)',
            subtitle: 'From: ' + (getHeader(headers, 'From') || 'unknown'),
            date: getHeader(headers, 'Date'),
            metadata: { snippet: d.snippet, labels: d.labelIds },
          });
        }
      }
      recvFetched = receivedItems.length;
      recvPageToken = list.nextPageToken || '';
      if (!recvPageToken) break;
    }

    const recvLog = receivedItems.slice(0, 5).map(e => '- **' + e.title + '** ← ' + (e.subtitle || '')).join('\n');
    onProgress?.({ phase: 'fetching', provider: 'google', progress: 50, message: receivedItems.length + ' received emails fetched', log: '### ✅ ' + receivedItems.length + ' received emails\n' + recvLog + (receivedItems.length > 5 ? '\n- _...and ' + (receivedItems.length - 5) + ' more_' : '') });

    sections.push({ name: 'received_emails', description: 'Emails received by the user (headers only)', items: receivedItems, totalAvailable: receivedItems.length });

    // ── Calendar Events ──
    onProgress?.({ phase: 'fetching', provider: 'google', progress: 55, message: 'Fetching calendar events...', log: '### 📅 Fetching calendar (past ' + calDaysBack + ' days + future ' + calDaysForward + ' days)...' });
    const pastDate = new Date(Date.now() - calDaysBack * 86400000).toISOString();
    const futureDate = new Date(Date.now() + calDaysForward * 86400000).toISOString();
    const now = new Date().toISOString();

    const calItems: DataItem[] = [];
    try {
      const [past, future] = await Promise.all([
        gapi(token, 'https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=' + encodeURIComponent(pastDate) + '&timeMax=' + encodeURIComponent(now) + '&maxResults=100&singleEvents=true&orderBy=startTime'),
        gapi(token, 'https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=' + encodeURIComponent(now) + '&timeMax=' + encodeURIComponent(futureDate) + '&maxResults=50&singleEvents=true&orderBy=startTime'),
      ]);

      for (const event of [...(past.items || []), ...(future.items || [])]) {
        calItems.push({
          title: event.summary || 'Untitled',
          subtitle: (event.attendees || []).map((a: { email: string; displayName?: string }) => a.displayName || a.email).join(', ') || undefined,
          date: event.start?.dateTime || event.start?.date || '',
          body: (event.description || '').substring(0, 300),
          metadata: { location: event.location, recurring: !!event.recurringEventId, status: event.status },
        });
      }
    } catch (err) {
      onProgress?.({ phase: 'fetching', provider: 'google', progress: 65, message: 'Calendar fetch failed: ' + String(err), log: '### ⚠️ Calendar fetch failed\n' + String(err) });
    }

    const calLog = calItems.slice(0, 5).map(e => '- 📅 **' + e.title + '** — ' + (e.date ? new Date(e.date).toLocaleDateString() : 'no date') + (e.subtitle ? ' (' + e.subtitle.substring(0, 50) + ')' : '')).join('\n');
    onProgress?.({ phase: 'fetching', provider: 'google', progress: 70, message: calItems.length + ' calendar events', log: '### ✅ ' + calItems.length + ' calendar events\n' + calLog + (calItems.length > 5 ? '\n- _...and ' + (calItems.length - 5) + ' more_' : '') });

    sections.push({ name: 'calendar_events', description: 'Calendar events (past + upcoming)', items: calItems, totalAvailable: calItems.length });

    // ── Google Drive (recent files) ──
    onProgress?.({ phase: 'fetching', provider: 'google', progress: 75, message: 'Fetching Drive files...', log: '### 📁 Fetching recent Drive files...' });
    const driveItems: DataItem[] = [];
    try {
      const driveData = await gapi(token, 'https://www.googleapis.com/drive/v3/files?pageSize=' + maxDriveFiles + '&orderBy=modifiedTime desc&fields=files(id,name,mimeType,modifiedTime,owners,shared,webViewLink)');
      for (const file of (driveData.files || [])) {
        driveItems.push({
          title: file.name,
          subtitle: file.mimeType?.replace('application/vnd.google-apps.', 'Google ') || file.mimeType,
          date: file.modifiedTime,
          metadata: { shared: file.shared, owners: file.owners?.map((o: { displayName: string }) => o.displayName) },
        });
      }
    } catch (err) {
      onProgress?.({ phase: 'fetching', provider: 'google', progress: 80, message: 'Drive fetch failed (may need additional scopes)', log: '### ⚠️ Drive fetch failed\n' + String(err) + '\n\n_This may require additional OAuth scopes._' });
    }

    if (driveItems.length > 0) {
      const driveLog = driveItems.slice(0, 8).map(e => '- 📄 **' + e.title + '** (' + (e.subtitle || 'file') + ')').join('\n');
      onProgress?.({ phase: 'fetching', provider: 'google', progress: 85, message: driveItems.length + ' Drive files', log: '### ✅ ' + driveItems.length + ' Drive files\n' + driveLog });
      sections.push({ name: 'drive_files', description: 'Recent Google Drive files', items: driveItems, totalAvailable: driveItems.length });
    }

    // ── Gmail Labels ──
    onProgress?.({ phase: 'fetching', provider: 'google', progress: 90, message: 'Fetching labels...', log: '### 🏷️ Fetching Gmail labels...' });
    try {
      const labelData = await gapi(token, 'https://gmail.googleapis.com/gmail/v1/users/me/labels');
      const userLabels = (labelData.labels || []).filter((l: { type: string }) => l.type === 'user');
      if (userLabels.length > 0) {
        const labelItems: DataItem[] = userLabels.map((l: { name: string; messagesTotal?: number }) => ({
          title: l.name,
          subtitle: l.messagesTotal ? l.messagesTotal + ' messages' : undefined,
        }));
        sections.push({ name: 'gmail_labels', description: 'Custom Gmail labels (shows how user organizes email)', items: labelItems, totalAvailable: labelItems.length });
        onProgress?.({ phase: 'fetching', provider: 'google', progress: 95, message: userLabels.length + ' custom labels', log: '### ✅ ' + userLabels.length + ' custom labels\n' + labelItems.slice(0, 10).map(l => '- 🏷️ ' + l.title).join('\n') });
      }
    } catch { /* labels are optional */ }

    onProgress?.({ phase: 'fetching', provider: 'google', progress: 100, message: 'Google data fetch complete', log: '### 🎉 Google Workspace data fetch complete\n**Total:** ' + sections.reduce((sum, s) => sum + s.items.length, 0) + ' items across ' + sections.length + ' categories' });

    return {
      provider: 'google',
      accountLabel: profile.emailAddress,
      sections,
      fetchedAt: new Date().toISOString(),
    };
  },
};
