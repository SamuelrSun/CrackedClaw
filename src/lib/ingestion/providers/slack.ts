/**
 * Slack native ingestion adapter
 * Scans channels and messages to extract communication patterns.
 */

import { saveMemory } from '@/lib/memory/service';
import { IngestResult } from '../engine';
import { getIntegrationToken } from './utils';

const SLACK_API = 'https://slack.com/api';

interface SlackChannel {
  id: string;
  name: string;
  num_members?: number;
  is_member?: boolean;
}

interface SlackMessage {
  ts: string;
  user?: string;
  text?: string;
  reply_count?: number;
  reactions?: { name: string; count: number }[];
}

async function slackGet(token: string, method: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(`${SLACK_API}/${method}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Slack API error: ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack error: ${data.error}`);
  return data;
}

export async function scanSlack(userId: string, scope: 'quick' | 'full'): Promise<IngestResult> {
  const startMs = Date.now();

  const token = await getIntegrationToken(userId, 'slack');
  if (!token) throw new Error('Slack integration not connected or missing access token');

  // List joined channels
  const channelsData = await slackGet(token, 'conversations.list', {
    types: 'public_channel,private_channel',
    limit: '200',
    exclude_archived: 'true',
  }) as { channels: SlackChannel[] };

  const allChannels: SlackChannel[] = channelsData.channels || [];
  const joined = allChannels.filter(c => c.is_member !== false);

  // Sort by member count to pick the most active 5
  const topChannels = joined
    .sort((a, b) => (b.num_members ?? 0) - (a.num_members ?? 0))
    .slice(0, 5);

  const msgLimit = scope === 'quick' ? '10' : '50';

  // Fetch messages from top channels
  const channelMessages: { channel: SlackChannel; messages: SlackMessage[] }[] = [];
  for (const channel of topChannels) {
    try {
      const histData = await slackGet(token, 'conversations.history', {
        channel: channel.id,
        limit: msgLimit,
      }) as { messages: SlackMessage[] };
      channelMessages.push({ channel, messages: histData.messages || [] });
    } catch {
      // skip channels we can't read
    }
  }

  // Analyze patterns
  const userFrequency: Record<string, number> = {};
  const topicWords: Record<string, number> = {};
  const STOPWORDS = new Set(['the','a','an','is','it','in','of','to','and','or','for','with','on','at','by','this','that','was','are','be','from','as','i','you','we','they','he','she','what','how','but','not','my','your','our','me','im','its','all','can','do','have','has','will','just','been','so','if','up','out','his','her','their','there','then','when','who','get','got','did','at','an','no','yes']);

  let totalMessages = 0;

  for (const { messages } of channelMessages) {
    totalMessages += messages.length;
    for (const msg of messages) {
      if (msg.user) userFrequency[msg.user] = (userFrequency[msg.user] ?? 0) + 1;
      const words = (msg.text || '').toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
      for (const w of words) {
        if (w.length > 3 && !STOPWORDS.has(w)) {
          topicWords[w] = (topicWords[w] ?? 0) + 1;
        }
      }
    }
  }

  const topUsers = Object.entries(userFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ name: id, frequency: count }));

  const topics = Object.entries(topicWords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);

  const channelActivity = topChannels.map(c => ({
    name: c.name,
    members: c.num_members ?? 0,
    messagesScanned: channelMessages.find(cm => cm.channel.id === c.id)?.messages.length ?? 0,
  }));

  const rawContext = [
    `Slack: ${allChannels.length} channels total, member of ${joined.length}`,
    `Top channels: ${topChannels.map(c => `#${c.name}`).join(', ')}`,
    `${totalMessages} messages scanned across top 5 channels`,
    topics.length > 0 ? `Common topics: ${topics.slice(0, 10).join(', ')}` : '',
    `Most active users (by message count in scanned channels): ${topUsers.slice(0, 5).map(u => `${u.name}(${u.frequency})`).join(', ')}`,
  ].filter(Boolean).join('\n');

  const result: IngestResult = {
    provider: 'slack',
    scannedAt: new Date().toISOString(),
    scope,
    insights: {
      contacts: topUsers,
      topics,
      rawContext,
    },
    metadata: {
      itemsScanned: totalMessages,
      timeMs: Date.now() - startMs,
    },
  };

  // Persist to memory
  const entries: Array<{ key: string; value: string; category: 'contact' | 'context' | 'schedule' | 'preference'; importance: number }> = [];

  if (topics.length > 0) {
    entries.push({ key: 'slack_topics', value: topics.join(', '), category: 'context', importance: 3 });
  }
  if (channelActivity.length > 0) {
    entries.push({ key: 'slack_channels', value: JSON.stringify(channelActivity), category: 'context', importance: 3 });
  }

  await Promise.all(
    entries.map(e => saveMemory(userId, e.key, e.value, { category: e.category, source: 'scan', importance: e.importance }))
  );

  return result;
}
