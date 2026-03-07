/**
 * Calendar Context Scanner
 * Scans upcoming and recent events to find meeting patterns and attendees
 */

import type {
  Scanner,
  ScannerResult,
  ScanOptions,
  CalendarScanResult,
  MeetingType,
  RecurringMeeting,
  FrequentAttendee,
  BusyTimeAnalysis,
  Insight,
} from './types';

// Google Calendar API types
interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
    self?: boolean;
    organizer?: boolean;
  }>;
  organizer?: {
    email?: string;
    displayName?: string;
    self?: boolean;
  };
  recurrence?: string[];
  recurringEventId?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  conferenceData?: {
    entryPoints?: Array<{ entryPointType: string; uri: string }>;
  };
}

interface CalendarListResponse {
  items?: CalendarEvent[];
  nextPageToken?: string;
}

// Meeting type detection rules
const MEETING_TYPE_RULES: Array<{
  type: string;
  keywords: RegExp[];
}> = [
  { type: '1:1', keywords: [/1[:\-]1/i, /one[:\-\s]?on[:\-\s]?one/i, /sync with/i, /catch up/i] },
  { type: 'Standup', keywords: [/standup/i, /stand-up/i, /daily sync/i, /scrum/i] },
  { type: 'Team Meeting', keywords: [/team meeting/i, /all hands/i, /team sync/i] },
  { type: 'Interview', keywords: [/interview/i, /screening/i, /candidate/i] },
  { type: 'External', keywords: [/call with/i, /meeting with.*external/i, /client/i, /customer/i] },
  { type: 'Planning', keywords: [/planning/i, /sprint/i, /roadmap/i, /kickoff/i] },
  { type: 'Review', keywords: [/review/i, /retro/i, /retrospective/i, /postmortem/i] },
  { type: 'Social', keywords: [/coffee/i, /lunch/i, /happy hour/i, /team building/i] },
  { type: 'Focus Time', keywords: [/focus time/i, /no meetings/i, /blocked/i, /do not book/i] },
];

// Days of week
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Helper to detect meeting type
function detectMeetingType(title: string): string {
  const normalizedTitle = title.toLowerCase();
  
  for (const rule of MEETING_TYPE_RULES) {
    if (rule.keywords.some(kw => kw.test(normalizedTitle))) {
      return rule.type;
    }
  }
  
  return 'Other';
}

// Helper to parse event duration in minutes
function getEventDuration(event: CalendarEvent): number {
  const start = event.start?.dateTime || event.start?.date;
  const end = event.end?.dateTime || event.end?.date;
  
  if (!start || !end) return 0;
  
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
}

// Helper to detect recurrence frequency
function detectRecurrenceFrequency(event: CalendarEvent): RecurringMeeting['frequency'] | null {
  const recurrence = event.recurrence?.[0];
  if (!recurrence) return null;
  
  if (recurrence.includes('DAILY')) return 'daily';
  if (recurrence.includes('WEEKLY')) {
    if (recurrence.includes('INTERVAL=2')) return 'biweekly';
    return 'weekly';
  }
  if (recurrence.includes('MONTHLY')) return 'monthly';
  
  return null;
}

// Calendar Scanner implementation
export const calendarScanner: Scanner = {
  id: 'calendar',
  name: 'Google Calendar',
  emoji: '📅',
  description: 'Analyze calendar patterns, meeting types, and attendees',
  requiredScopes: [
    'https://www.googleapis.com/auth/calendar.readonly',
  ],

  async scan(userId: string, accessToken: string, options?: ScanOptions): Promise<CalendarScanResult> {
    const startTime = Date.now();
    const daysBack = options?.daysBack ?? 20;
    const daysAhead = 14; // Also look at upcoming events
    const maxItems = options?.maxItems ?? 500;
    
    // Calculate date range
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - daysBack);
    
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + daysAhead);
    
    // Track meeting types
    const meetingTypes = new Map<string, {
      count: number;
      totalDuration: number;
      examples: Set<string>;
    }>();
    
    // Track attendees
    const attendeeMap = new Map<string, {
      email: string;
      name: string;
      count: number;
      lastMeeting: string;
    }>();
    
    // Track recurring meetings
    const recurringMap = new Map<string, {
      title: string;
      frequency: RecurringMeeting['frequency'];
      dayOfWeek?: string;
      time?: string;
      attendees: Set<string>;
      count: number;
    }>();
    
    // Track busy times for analysis
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    const busySlots: Array<{ day: number; hour: number; duration: number }> = [];
    
    let totalMeetings = 0;
    let upcomingCount = 0;
    let userEmail = '';
    
    try {
      // Get user's email for identifying self in attendees
      const profileResponse = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        userEmail = profile.email?.toLowerCase() || '';
      }
      
      // Fetch calendar events
      let pageToken: string | undefined;
      let fetchedCount = 0;
      
      while (fetchedCount < maxItems) {
        const listUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
        listUrl.searchParams.set('maxResults', String(Math.min(250, maxItems - fetchedCount)));
        listUrl.searchParams.set('timeMin', minDate.toISOString());
        listUrl.searchParams.set('timeMax', maxDate.toISOString());
        listUrl.searchParams.set('singleEvents', 'true');
        listUrl.searchParams.set('orderBy', 'startTime');
        
        if (pageToken) {
          listUrl.searchParams.set('pageToken', pageToken);
        }
        
        const listResponse = await fetch(listUrl.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        
        if (!listResponse.ok) {
          console.error('Calendar list failed:', await listResponse.text());
          break;
        }
        
        const listData: CalendarListResponse = await listResponse.json();
        
        if (!listData.items?.length) break;
        
        for (const event of listData.items) {
          // Skip cancelled events
          if (event.status === 'cancelled') continue;
          
          // Skip all-day events (focus on meetings)
          if (event.start?.date && !event.start?.dateTime) continue;
          
          const title = event.summary || 'Untitled';
          const startStr = event.start?.dateTime || event.start?.date || '';
          const startDate = new Date(startStr);
          const duration = getEventDuration(event);
          
          // Skip very long events (probably blocking, not meetings)
          if (duration > 480) continue; // 8+ hours
          
          totalMeetings++;
          
          // Count upcoming vs past
          if (startDate > new Date()) {
            upcomingCount++;
          }
          
          // Track meeting type
          const meetingType = detectMeetingType(title);
          const existing = meetingTypes.get(meetingType) || {
            count: 0,
            totalDuration: 0,
            examples: new Set<string>(),
          };
          existing.count++;
          existing.totalDuration += duration;
          if (existing.examples.size < 3) {
            existing.examples.add(title.slice(0, 40));
          }
          meetingTypes.set(meetingType, existing);
          
          // Track attendees (excluding self)
          for (const attendee of event.attendees || []) {
            if (attendee.self) continue;
            if (!attendee.email) continue;
            if (attendee.responseStatus === 'declined') continue;
            
            const email = attendee.email.toLowerCase();
            const existingAttendee = attendeeMap.get(email) || {
              email,
              name: attendee.displayName || email.split('@')[0],
              count: 0,
              lastMeeting: startStr,
            };
            existingAttendee.count++;
            if (startStr > existingAttendee.lastMeeting) {
              existingAttendee.lastMeeting = startStr;
            }
            attendeeMap.set(email, existingAttendee);
          }
          
          // Track recurring meetings
          if (event.recurringEventId) {
            const recurringId = event.recurringEventId;
            const existingRecurring = recurringMap.get(recurringId);
            
            if (existingRecurring) {
              existingRecurring.count++;
              for (const att of event.attendees || []) {
                if (att.email && !att.self) {
                  existingRecurring.attendees.add(att.email);
                }
              }
            } else {
              // First time seeing this recurring event
              recurringMap.set(recurringId, {
                title,
                frequency: 'weekly', // Will be refined
                dayOfWeek: DAYS[startDate.getDay()],
                time: startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
                attendees: new Set(
                  (event.attendees || [])
                    .filter(a => a.email && !a.self)
                    .map(a => a.email!)
                ),
                count: 1,
              });
            }
          }
          
          // Track busy times
          const hour = startDate.getHours();
          const day = startDate.getDay();
          hourCounts[hour]++;
          dayCounts[day]++;
          busySlots.push({ day, hour, duration });
        }
        
        fetchedCount += listData.items.length;
        pageToken = listData.nextPageToken as string | undefined;
        
        if (!pageToken) break;
      }
    } catch (error) {
      console.error('Calendar scan error:', error);
      throw error;
    }
    
    // Build meeting types list
    const meetingTypesList: MeetingType[] = Array.from(meetingTypes.entries())
      .map(([type, data]) => ({
        type,
        count: data.count,
        averageDuration: Math.round(data.totalDuration / data.count),
        examples: Array.from(data.examples),
      }))
      .sort((a, b) => b.count - a.count);
    
    // Build frequent attendees list
    const frequentAttendees: FrequentAttendee[] = Array.from(attendeeMap.values())
      .filter(a => a.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map(a => ({
        email: a.email,
        name: a.name,
        meetingCount: a.count,
        lastMeeting: a.lastMeeting,
      }));
    
    // Build recurring meetings list
    const recurringMeetings: RecurringMeeting[] = Array.from(recurringMap.values())
      .filter(r => r.count >= 2) // Must have appeared at least twice
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(r => ({
        title: r.title,
        frequency: r.frequency,
        dayOfWeek: r.dayOfWeek,
        time: r.time,
        attendees: Array.from(r.attendees).slice(0, 5),
      }));
    
    // Analyze busy times
    const busiestHour = hourCounts.indexOf(Math.max(...hourCounts));
    const busiestDay = DAYS[dayCounts.indexOf(Math.max(...dayCounts))];
    const avgMeetingsPerDay = totalMeetings / (daysBack + daysAhead);
    const avgDuration = meetingTypesList.reduce(
      (sum, mt) => sum + mt.averageDuration * mt.count, 0
    ) / (totalMeetings || 1);
    
    // Find free time blocks (simplified)
    const freeTimeBlocks: Array<{ day: string; start: string; end: string }> = [];
    for (let day = 1; day <= 5; day++) { // Mon-Fri
      const daySlots = busySlots.filter(s => s.day === day);
      if (daySlots.length < 3) {
        freeTimeBlocks.push({
          day: DAYS[day],
          start: '9:00 AM',
          end: '5:00 PM',
        });
      }
    }
    
    const busyTimeAnalysis: BusyTimeAnalysis = {
      busiestDay,
      busiestHour,
      averageMeetingsPerDay: Math.round(avgMeetingsPerDay * 10) / 10,
      averageMeetingDuration: Math.round(avgDuration),
      freeTimeBlocks: freeTimeBlocks.slice(0, 3),
    };
    
    // Generate insights
    const insights: Insight[] = [];
    
    // Meeting load insight
    if (avgMeetingsPerDay > 5) {
      insights.push({
        type: 'pattern',
        content: `Heavy meeting load — ${Math.round(avgMeetingsPerDay)} meetings per day on average`,
        confidence: 0.9,
        metadata: { avgMeetingsPerDay },
      });
    } else if (avgMeetingsPerDay < 2) {
      insights.push({
        type: 'pattern',
        content: `Light calendar — only ${Math.round(avgMeetingsPerDay * 10) / 10} meetings per day`,
        confidence: 0.8,
        metadata: { avgMeetingsPerDay },
      });
    }
    
    // Recurring meetings insight
    if (recurringMeetings.length > 0) {
      insights.push({
        type: 'pattern',
        content: `${recurringMeetings.length} recurring meetings detected (${recurringMeetings.slice(0, 2).map(r => r.title).join(', ')})`,
        confidence: 0.95,
        metadata: { recurringCount: recurringMeetings.length },
      });
    }
    
    // Top attendee insight
    if (frequentAttendees.length > 0) {
      const top = frequentAttendees[0];
      insights.push({
        type: 'contact',
        content: `You meet with ${top.name} most frequently (${top.meetingCount} meetings)`,
        confidence: Math.min(top.meetingCount / 10, 1),
        metadata: { contactEmail: top.email },
      });
    }
    
    // 1:1 meetings insight
    const oneOnOnes = meetingTypesList.find(mt => mt.type === '1:1');
    if (oneOnOnes && oneOnOnes.count >= 5) {
      insights.push({
        type: 'pattern',
        content: `${oneOnOnes.count} 1:1 meetings — important for relationship building`,
        confidence: 0.85,
        metadata: { count: oneOnOnes.count },
      });
    }
    
    // Suggested automations
    const suggestedAutomations: string[] = [];
    
    if (recurringMeetings.length >= 3) {
      suggestedAutomations.push(`Prepare agenda templates for your ${recurringMeetings.length} recurring meetings`);
    }
    
    if (avgMeetingsPerDay > 4) {
      suggestedAutomations.push(`Block focus time — your calendar is heavy (${Math.round(avgMeetingsPerDay)} meetings/day)`);
    }
    
    if (frequentAttendees.length > 5) {
      suggestedAutomations.push(`Set up quick meeting links for your top ${Math.min(frequentAttendees.length, 10)} collaborators`);
    }
    
    const standups = meetingTypesList.find(mt => mt.type === 'Standup');
    if (standups && standups.count >= 5) {
      suggestedAutomations.push(`Auto-generate standup notes from your calendar and todos`);
    }
    
    const timeMs = Date.now() - startTime;
    
    return {
      source: 'calendar',
      scannedAt: new Date(),
      summary: `Analyzed ${totalMeetings} meetings (${upcomingCount} upcoming). Found ${recurringMeetings.length} recurring meetings and ${frequentAttendees.length} frequent attendees.`,
      insights,
      suggestedAutomations,
      stats: {
        itemsScanned: totalMeetings,
        timeMs,
      },
      data: {
        meetingTypes: meetingTypesList,
        recurringMeetings,
        frequentAttendees,
        busyTimeAnalysis,
        upcomingCount,
        totalMeetings,
      },
    };
  },
};

export default calendarScanner;
