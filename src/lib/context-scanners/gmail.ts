/**
 * Gmail Context Scanner
 * Scans last 20 days of emails to find patterns, contacts, and pending threads
 */

import type {
  Scanner,
  ScannerResult,
  ScanOptions,
  GmailScanResult,
  FrequentContact,
  EmailPattern,
  PendingThread,
  Insight,
} from './types';

// Gmail API types
interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    mimeType?: string;
    parts?: Array<{ mimeType: string; body?: { data?: string } }>;
  };
  internalDate?: string;
}

interface GmailThread {
  id: string;
  messages?: GmailMessage[];
  snippet?: string;
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

// Pattern detection rules
const PATTERN_RULES: Array<{
  type: EmailPattern['type'];
  description: string;
  keywords: RegExp[];
  senderPatterns: RegExp[];
}> = [
  {
    type: 'newsletter',
    description: 'Email newsletters and subscriptions',
    keywords: [/unsubscribe/i, /newsletter/i, /weekly digest/i, /daily digest/i],
    senderPatterns: [/noreply@/i, /newsletter@/i, /updates@/i, /digest@/i, /substack\.com/i],
  },
  {
    type: 'receipt',
    description: 'Purchase receipts and order confirmations',
    keywords: [/receipt/i, /order confirmed/i, /purchase/i, /invoice/i, /payment received/i],
    senderPatterns: [/receipt@/i, /orders@/i, /billing@/i, /payments@/i],
  },
  {
    type: 'notification',
    description: 'App and service notifications',
    keywords: [/notification/i, /alert/i, /new comment/i, /mentioned you/i, /assigned to you/i],
    senderPatterns: [/notifications@/i, /notify@/i, /alerts@/i, /noreply@/i],
  },
  {
    type: 'social',
    description: 'Social media notifications',
    keywords: [/followed you/i, /liked your/i, /new follower/i, /connection request/i],
    senderPatterns: [/@linkedin/i, /@twitter/i, /@facebook/i, /@instagram/i, /facebookmail/i],
  },
  {
    type: 'promotional',
    description: 'Marketing and promotional emails',
    keywords: [/% off/i, /sale/i, /limited time/i, /exclusive offer/i, /deal/i],
    senderPatterns: [/marketing@/i, /promo@/i, /offers@/i],
  },
  {
    type: 'travel',
    description: 'Travel confirmations and itineraries',
    keywords: [/booking confirmed/i, /itinerary/i, /flight/i, /reservation/i, /check-in/i],
    senderPatterns: [/@airbnb/i, /@booking\.com/i, /@expedia/i, /@united/i, /@delta/i, /@southwest/i],
  },
];

// Helper to extract header value
function getHeader(headers: Array<{ name: string; value: string }> | undefined, name: string): string {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

// Helper to parse email address
function parseEmailAddress(raw: string): { email: string; name: string } {
  const match = raw.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+@[^>]+)>?$/);
  if (match) {
    return {
      name: (match[1] || match[2]).trim(),
      email: match[2].toLowerCase().trim(),
    };
  }
  return { email: raw.toLowerCase().trim(), name: raw.trim() };
}

// Helper to extract domain from email
function getDomain(email: string): string {
  const parts = email.split('@');
  return parts.length > 1 ? parts[1] : email;
}

// Gmail Scanner implementation
export const gmailScanner: Scanner = {
  id: 'gmail',
  name: 'Gmail',
  emoji: '📧',
  description: 'Scan emails to find contacts, patterns, and pending threads',
  requiredScopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
  ],

  async scan(userId: string, accessToken: string, options?: ScanOptions): Promise<GmailScanResult> {
    const startTime = Date.now();
    const daysBack = options?.daysBack ?? 20;
    const maxItems = options?.maxItems ?? 500;
    
    // Calculate date range
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - daysBack);
    const afterTimestamp = Math.floor(afterDate.getTime() / 1000);
    
    // Track contacts
    const contactMap = new Map<string, {
      email: string;
      name: string;
      sentCount: number;
      receivedCount: number;
      lastContact: string;
    }>();
    
    // Track patterns
    const patternCounts = new Map<EmailPattern['type'], {
      count: number;
      examples: Set<string>;
      senderDomains: Set<string>;
    }>();
    
    // Track threads for pending detection
    const threadLastSender = new Map<string, {
      from: string;
      subject: string;
      date: string;
      isMe: boolean;
    }>();
    
    let totalEmails = 0;
    let unreadCount = 0;
    let userEmail = '';
    
    try {
      // Get user's email address first
      const profileResponse = await fetch(
        'https://www.googleapis.com/gmail/v1/users/me/profile',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        userEmail = profile.emailAddress?.toLowerCase() || '';
      }
      
      // Fetch messages
      let pageToken: string | undefined;
      let fetchedCount = 0;
      
      while (fetchedCount < maxItems) {
        const listUrl = new URL('https://www.googleapis.com/gmail/v1/users/me/messages');
        listUrl.searchParams.set('maxResults', String(Math.min(100, maxItems - fetchedCount)));
        listUrl.searchParams.set('q', `after:${afterTimestamp}`);
        if (pageToken) {
          listUrl.searchParams.set('pageToken', pageToken);
        }
        
        const listResponse = await fetch(listUrl.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        
        if (!listResponse.ok) {
          console.error('Gmail list failed:', await listResponse.text());
          break;
        }
        
        const listData: GmailListResponse = await listResponse.json();
        
        if (!listData.messages?.length) break;
        
        // Batch fetch message details (max 50 at a time for performance)
        const batchSize = 50;
        for (let i = 0; i < listData.messages.length; i += batchSize) {
          const batch = listData.messages.slice(i, i + batchSize);
          
          // Use batch API for efficiency
          const messagePromises = batch.map(async (msg) => {
            const msgResponse = await fetch(
              `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            
            if (!msgResponse.ok) return null;
            return msgResponse.json() as Promise<GmailMessage>;
          });
          
          const messages = (await Promise.all(messagePromises)).filter(Boolean) as GmailMessage[];
          
          for (const message of messages) {
            totalEmails++;
            
            // Track unread
            if (message.labelIds?.includes('UNREAD')) {
              unreadCount++;
            }
            
            const headers = message.payload?.headers;
            const fromRaw = getHeader(headers, 'From');
            const toRaw = getHeader(headers, 'To');
            const subject = getHeader(headers, 'Subject');
            const dateStr = getHeader(headers, 'Date');
            const snippet = message.snippet || '';
            
            const from = parseEmailAddress(fromRaw);
            const isFromMe = from.email === userEmail || from.email.includes(userEmail.split('@')[0]);
            
            // Track contacts
            if (isFromMe) {
              // I sent this - track recipients
              const recipients = toRaw.split(',').map(r => parseEmailAddress(r.trim()));
              for (const recipient of recipients) {
                if (recipient.email && !recipient.email.includes('noreply')) {
                  const existing = contactMap.get(recipient.email) || {
                    email: recipient.email,
                    name: recipient.name,
                    sentCount: 0,
                    receivedCount: 0,
                    lastContact: dateStr,
                  };
                  existing.sentCount++;
                  if (dateStr > existing.lastContact) {
                    existing.lastContact = dateStr;
                  }
                  contactMap.set(recipient.email, existing);
                }
              }
            } else {
              // I received this - track sender
              if (from.email && !from.email.includes('noreply')) {
                const existing = contactMap.get(from.email) || {
                  email: from.email,
                  name: from.name,
                  sentCount: 0,
                  receivedCount: 0,
                  lastContact: dateStr,
                };
                existing.receivedCount++;
                if (dateStr > existing.lastContact) {
                  existing.lastContact = dateStr;
                }
                contactMap.set(from.email, existing);
              }
            }
            
            // Detect patterns
            const fullText = `${fromRaw} ${subject} ${snippet}`.toLowerCase();
            const senderDomain = getDomain(from.email);
            
            for (const rule of PATTERN_RULES) {
              const matchesKeyword = rule.keywords.some(kw => kw.test(fullText));
              const matchesSender = rule.senderPatterns.some(sp => sp.test(from.email) || sp.test(senderDomain));
              
              if (matchesKeyword || matchesSender) {
                const existing = patternCounts.get(rule.type) || {
                  count: 0,
                  examples: new Set<string>(),
                  senderDomains: new Set<string>(),
                };
                existing.count++;
                if (existing.examples.size < 5) {
                  existing.examples.add(subject.slice(0, 50));
                }
                existing.senderDomains.add(senderDomain);
                patternCounts.set(rule.type, existing);
                break; // Only count once per pattern
              }
            }
            
            // Track thread for pending detection
            threadLastSender.set(message.threadId, {
              from: from.email,
              subject,
              date: dateStr,
              isMe: isFromMe,
            });
          }
        }
        
        fetchedCount += listData.messages.length;
        pageToken = listData.nextPageToken;
        
        if (!pageToken) break;
      }
    } catch (error) {
      console.error('Gmail scan error:', error);
      throw error;
    }
    
    // Build frequent contacts list
    const frequentContacts: FrequentContact[] = Array.from(contactMap.values())
      .map(c => ({
        email: c.email,
        name: c.name,
        count: c.sentCount + c.receivedCount,
        lastContact: c.lastContact,
        isRecipient: c.sentCount > c.receivedCount,
      }))
      .filter(c => c.count >= 2) // At least 2 interactions
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    
    // Build patterns list
    const patterns: EmailPattern[] = Array.from(patternCounts.entries())
      .map(([type, data]) => {
        const rule = PATTERN_RULES.find(r => r.type === type)!;
        return {
          type,
          description: rule.description,
          examples: Array.from(data.examples),
          count: data.count,
          senderDomains: Array.from(data.senderDomains).slice(0, 5),
        };
      })
      .filter(p => p.count >= 3) // At least 3 occurrences
      .sort((a, b) => b.count - a.count);
    
    // Find pending threads (I'm waiting for response OR they're waiting)
    const pendingThreads: PendingThread[] = Array.from(threadLastSender.entries())
      .filter(([, info]) => {
        // Thread where I was the last sender = waiting for them
        // Thread where they were last sender = waiting for me (but not automated emails)
        if (info.isMe) return true;
        // Only consider human conversations as "waiting for me"
        const isAutomated = PATTERN_RULES.some(rule => 
          rule.senderPatterns.some(sp => sp.test(info.from))
        );
        return !isAutomated;
      })
      .slice(0, 10)
      .map(([threadId, info]) => ({
        threadId,
        subject: info.subject,
        from: info.from,
        lastMessageDate: info.date,
        waitingFor: info.isMe ? 'them' as const : 'me' as const,
      }));
    
    // Generate insights
    const insights: Insight[] = [];
    
    // Top contacts insight
    if (frequentContacts.length > 0) {
      const topContact = frequentContacts[0];
      insights.push({
        type: 'contact',
        content: `You email ${topContact.name || topContact.email} frequently (${topContact.count} times in ${daysBack} days)`,
        confidence: Math.min(topContact.count / 20, 1),
        metadata: { contactEmail: topContact.email },
      });
    }
    
    // Pattern insights
    for (const pattern of patterns.slice(0, 3)) {
      if (pattern.count >= 10) {
        insights.push({
          type: 'pattern',
          content: `You receive many ${pattern.type} emails (${pattern.count} in ${daysBack} days)`,
          confidence: Math.min(pattern.count / 50, 1),
          metadata: { patternType: pattern.type, count: pattern.count },
        });
      }
    }
    
    // Pending threads insight
    const waitingForMe = pendingThreads.filter(t => t.waitingFor === 'me').length;
    if (waitingForMe > 3) {
      insights.push({
        type: 'task',
        content: `You have ${waitingForMe} threads that may need your response`,
        confidence: 0.8,
        metadata: { pendingCount: waitingForMe },
      });
    }
    
    // Suggested automations
    const suggestedAutomations: string[] = [];
    
    const newsletterPattern = patterns.find(p => p.type === 'newsletter');
    if (newsletterPattern && newsletterPattern.count >= 20) {
      suggestedAutomations.push(`Auto-archive newsletters (${newsletterPattern.count} received) — save time in your inbox`);
    }
    
    const receiptPattern = patterns.find(p => p.type === 'receipt');
    if (receiptPattern && receiptPattern.count >= 5) {
      suggestedAutomations.push(`Auto-label receipts and forward to expense tracking — ${receiptPattern.count} receipts detected`);
    }
    
    const notificationPattern = patterns.find(p => p.type === 'notification');
    if (notificationPattern && notificationPattern.count >= 30) {
      suggestedAutomations.push(`Bundle app notifications into daily digest — ${notificationPattern.count} notifications clogging inbox`);
    }
    
    if (frequentContacts.length > 5) {
      suggestedAutomations.push(`Prioritize emails from your top ${Math.min(frequentContacts.length, 10)} contacts`);
    }
    
    const timeMs = Date.now() - startTime;
    
    return {
      source: 'gmail',
      scannedAt: new Date(),
      summary: `Scanned ${totalEmails} emails from the last ${daysBack} days. Found ${frequentContacts.length} frequent contacts and ${patterns.length} patterns.`,
      insights,
      suggestedAutomations,
      stats: {
        itemsScanned: totalEmails,
        timeMs,
      },
      data: {
        frequentContacts,
        patterns,
        pendingThreads,
        totalEmails,
        unreadCount,
      },
    };
  },
};

export default gmailScanner;
