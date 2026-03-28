import { createClient } from './server'
import type { Integration, IntegrationType, IntegrationStatus, IntegrationAccount } from '@/types/integration'
import type {
  Workflow,
  Conversation,
  Message,
  MemoryEntry,
  ActivityItem,
  TeamMember,
  TokenUsage,
} from '../mock-data'

// ============================================
// Default empty values (no mock fallback)
// ============================================

const defaultTokenUsage: TokenUsage = {
  used: 0,
  limit: 1_000_000,
  resetDate: "—",
};

// Usage history item type
export interface UsageHistoryItem {
  date: string;
  tokens_used: number;
}

// ============================================
// Data Fetching Functions
// ============================================

// Fetch workflows - returns empty array if none
export async function getWorkflows(): Promise<Workflow[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .order('created_at', { ascending: false })

    if (error || !data) {
      console.error('Failed to fetch workflows:', error)
      return []
    }

    return data.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      status: w.status,
      lastRun: w.last_run || 'Never',
      icon: w.icon || 'Zap',
    }))
  } catch (err) {
    console.error('Workflows fetch error:', err)
    return []
  }
}

// Fetch integrations - returns empty array if none
export async function getIntegrations(): Promise<Integration[]> {
  try {
    const supabase = await createClient()

    // Fetch both the static integrations list and actual OAuth connections
    const [integrationsResult, userIntegrationsResult] = await Promise.all([
      supabase.from('integrations').select('*').order('name'),
      supabase.from('user_integrations').select('*').eq('status', 'connected'),
    ])

    // Build a map of connected providers from user_integrations
    const connectedMap: Record<string, { id: string; email?: string; name?: string; picture?: string; created_at?: string; is_default?: boolean }[]> = {}
    for (const ui of userIntegrationsResult.data || []) {
      if (!connectedMap[ui.provider]) connectedMap[ui.provider] = []
      connectedMap[ui.provider].push({
        id: ui.id,
        email: ui.account_email,
        name: ui.account_name,
        picture: ui.account_picture,
        created_at: ui.created_at,
        is_default: ui.is_default ?? false,
      })
    }

    // If there are no static integrations rows but we have OAuth connections, build from OAuth
    const staticData = integrationsResult.data || []

    // Merge: update static integrations with real connection status
    const merged = staticData.map((i): Integration => {
      const SLUG_TO_PROVIDER: Record<string, string> = {
        'google-workspace': 'google',
        'google-drive': 'google',
        'google-calendar': 'google',
        'google-meet': 'google',
        'microsoft-teams': 'microsoft',
        'microsoft-365': 'microsoft',
      };
      const provider = (i.slug && SLUG_TO_PROVIDER[i.slug]) || i.slug?.replace(/-/g, '') || i.name?.toLowerCase()
      const connected = connectedMap[provider] || connectedMap[i.name?.toLowerCase()] || []
      const isConnected = connected.length > 0

      return {
        id: i.id,
        user_id: i.user_id,
        name: i.name,
        slug: i.slug,
        icon: i.icon || '🔗',
        type: i.type as IntegrationType,
        status: isConnected ? 'connected' as IntegrationStatus : i.status as IntegrationStatus,
        config: i.config || {},
        accounts: isConnected ? connected.map((c) => ({
          id: c.id,
          email: c.email || '',
          name: c.name || c.email || 'Connected',
          picture: c.picture,
          connectedAt: c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Recently',
          is_default: c.is_default ?? false,
        })) as IntegrationAccount[] : (i.accounts || []) as IntegrationAccount[],
        last_sync: i.last_sync,
        created_at: i.created_at,
        updated_at: i.updated_at,
      }
    })

    // Also add any OAuth connections not in the static list (e.g. google)
    for (const [provider, accounts] of Object.entries(connectedMap)) {
      const alreadyIncluded = merged.some(m =>
        m.slug?.includes(provider) || m.name?.toLowerCase().includes(provider)
      )
      if (!alreadyIncluded) {
        const name = provider.charAt(0).toUpperCase() + provider.slice(1)
        merged.push({
          id: `oauth-${provider}`,
          user_id: '',
          name,
          slug: provider,
          icon: provider === 'google' ? '🔵' : provider === 'slack' ? '💬' : '📝',
          type: 'oauth' as IntegrationType,
          status: 'connected' as IntegrationStatus,
          config: {},
          accounts: accounts.map((c) => ({
            id: c.id,
            email: c.email || '',
            name: c.name || c.email || 'Connected',
            picture: c.picture,
            connectedAt: c.created_at ? new Date(c.created_at).toLocaleDateString() : 'Recently',
            is_default: c.is_default ?? false,
          })) as IntegrationAccount[],
          last_sync: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
    }

    // Also fetch Maton connections and add as cards if not already present
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('instance_settings')
        .single();
      const settings = (profile?.instance_settings as Record<string, unknown>) || {};
      const matonKey = (settings.maton_api_key as string) || '';
      if (matonKey) {
        const matonRes = await fetch('https://ctrl.maton.ai/connections?status=ACTIVE', {
          headers: { 'Authorization': `Bearer ${matonKey}` },
          signal: AbortSignal.timeout(8_000),
        });
        if (matonRes.ok) {
          const matonData = await matonRes.json();
          const connections = (matonData.connections || []) as Array<{
            connection_id: string;
            app: string;
            status: string;
            metadata?: { email?: string; name?: string; picture?: string };
            creation_time?: string;
          }>;
          for (const conn of connections) {
            // Check if this Maton app is already shown as a card
            const appSlug = conn.app;
            const alreadyShown = merged.some(m =>
              m.slug === appSlug ||
              m.slug?.includes(appSlug.replace('google-', '')) ||
              m.name?.toLowerCase().replace(/\s+/g, '-') === appSlug
            );
            if (!alreadyShown) {
              const appName = appSlug
                .split('-')
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
              merged.push({
                id: `maton-${conn.connection_id}`,
                user_id: '',
                name: appName,
                slug: appSlug,
                icon: '🔗',
                type: 'oauth' as IntegrationType,
                status: 'connected' as IntegrationStatus,
                config: { apiProvider: 'maton', matonConnectionId: conn.connection_id },
                accounts: [{
                  id: conn.connection_id,
                  email: conn.metadata?.email || '',
                  name: conn.metadata?.name || conn.metadata?.email || 'Connected via Maton',
                  picture: conn.metadata?.picture,
                  connectedAt: conn.creation_time ? new Date(conn.creation_time).toLocaleDateString() : 'Recently',
                  is_default: true,
                }] as IntegrationAccount[],
                last_sync: null,
                created_at: conn.creation_time || new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch (matonErr) {
      console.error('Maton connections fetch error (non-fatal):', matonErr);
    }

    return merged
  } catch (err) {
    console.error('Integrations fetch error:', err)
    return []
  }
}

// Fetch conversations - returns empty array if none
export async function getConversations(userId?: string): Promise<Conversation[]> {
  try {
    const supabase = await createClient()
    let convoQuery = supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })

    if (userId) {
      convoQuery = convoQuery.eq('user_id', userId)
    }

    const { data, error } = await convoQuery

    if (error || !data) {
      console.error('Failed to fetch conversations:', error)
      return []
    }

    return data.map((c) => ({
      id: c.id,
      title: c.title,
      lastMessage: '',
      timestamp: c.updated_at || 'Unknown',
    }))
  } catch (err) {
    console.error('Conversations fetch error:', err)
    return []
  }
}

// Fetch messages - returns empty array if none
export async function getMessages(conversationId?: string, userId?: string): Promise<Message[]> {
  try {
    const supabase = await createClient()
    let query = supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })

    if (conversationId) {
      query = query.eq('conversation_id', conversationId)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query

    if (error || !data) {
      console.error('Failed to fetch messages:', error)
      return []
    }

    return data.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.created_at || 'Unknown',
    }))
  } catch (err) {
    console.error('Messages fetch error:', err)
    return []
  }
}

// Fetch memory entries - returns empty array if none
export async function getMemoryEntries(): Promise<MemoryEntry[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('memory_entries')
      .select('*')
      .order('created_at', { ascending: false })

    if (error || !data) {
      console.error('Failed to fetch memory entries:', error)
      return []
    }

    return data.map((e) => ({
      id: e.id,
      content: e.content,
      category: e.category,
      createdAt: e.created_at || 'Unknown',
    }))
  } catch (err) {
    console.error('Memory entries fetch error:', err)
    return []
  }
}

// Create a new memory entry
export async function createMemoryEntry(entry: {
  title?: string;
  content: string;
  category?: string;
}): Promise<MemoryEntry> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Not authenticated')
    }

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('memory_entries')
      .insert({
        user_id: user.id,
        title: entry.title || null,
        content: entry.content,
        category: entry.category || 'Other',
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (error || !data) {
      console.error('Failed to create memory entry:', error)
      throw new Error(error?.message || 'Failed to create memory entry')
    }

    return {
      id: data.id,
      content: data.content,
      category: data.category,
      createdAt: data.created_at || 'Unknown',
    }
  } catch (err) {
    console.error('Create memory entry error:', err)
    throw err
  }
}

// Update an existing memory entry
export async function updateMemoryEntry(
  id: string,
  entry: Partial<{ title?: string; content: string; category: string }>
): Promise<MemoryEntry> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Not authenticated')
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('memory_entries')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || existing.user_id !== user.id) {
      throw new Error('Memory entry not found or access denied')
    }

    const { data, error } = await supabase
      .from('memory_entries')
      .update({
        ...(entry.title !== undefined && { title: entry.title }),
        ...(entry.content !== undefined && { content: entry.content }),
        ...(entry.category !== undefined && { category: entry.category }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      console.error('Failed to update memory entry:', error)
      throw new Error(error?.message || 'Failed to update memory entry')
    }

    return {
      id: data.id,
      content: data.content,
      category: data.category,
      createdAt: data.created_at || 'Unknown',
    }
  } catch (err) {
    console.error('Update memory entry error:', err)
    throw err
  }
}

// Delete a memory entry
export async function deleteMemoryEntry(id: string): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Not authenticated')
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('memory_entries')
      .select('user_id')
      .eq('id', id)
      .single()

    if (!existing || existing.user_id !== user.id) {
      throw new Error('Memory entry not found or access denied')
    }

    const { error } = await supabase
      .from('memory_entries')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Failed to delete memory entry:', error)
      throw new Error(error.message || 'Failed to delete memory entry')
    }
  } catch (err) {
    console.error('Delete memory entry error:', err)
    throw err
  }
}


// Activity Log Query Options
export interface ActivityLogOptions {
  limit?: number;
  offset?: number;
  actionFilter?: string;  // Filter by action type (e.g., "workflow", "memory")
  dateFrom?: string;      // ISO date string for start date
  dateTo?: string;        // ISO date string for end date
}

export async function getActivityLog(options: ActivityLogOptions | number = 10): Promise<ActivityItem[]> {
  // Handle backwards compatibility with just a limit number
  const opts: ActivityLogOptions = typeof options === 'number' 
    ? { limit: options } 
    : options;
  
  const { 
    limit = 10, 
    offset = 0, 
    actionFilter, 
    dateFrom, 
    dateTo 
  } = opts;
  
  try {
    const supabase = await createClient()
    let query = supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })

    // Apply date filters
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    // Apply action type filter (partial match)
    if (actionFilter) {
      query = query.ilike('action', `%${actionFilter}%`)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error } = await query

    if (error || !data) {
      console.error('Failed to fetch activity log:', error)
      return []
    }

    return data.map((a) => ({
      id: a.id,
      action: a.action,
      detail: a.detail || '',
      timestamp: a.created_at || 'Unknown',
    }))
  } catch (err) {
    console.error('Activity log fetch error:', err)
    return []
  }
}
// Log an activity event
export async function logActivity(
  action: string,
  detail?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    const { error } = await supabase
      .from('activity_log')
      .insert({
        user_id: user?.id,
        action,
        detail: detail || null,
        metadata: metadata || null,
        created_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Failed to log activity:', error)
    }
  } catch (err) {
    console.error('Activity log error:', err)
  }
}


// Fetch token usage - returns defaults if none
export async function getTokenUsage(): Promise<TokenUsage> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return defaultTokenUsage
    }

    const { data, error } = await supabase
      .from('token_usage')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      // No data yet is normal - return defaults
      return defaultTokenUsage
    }

    return {
      used: data.used || 0,
      limit: data.limit_amount || 1_000_000,
      resetDate: data.reset_date || '—',
    }
  } catch (err) {
    console.error('Token usage fetch error:', err)
    return defaultTokenUsage
  }
}

// Update token usage - increment the used count
export async function updateTokenUsage(tokensUsed: number): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.error('No user found for token usage update')
      return
    }

    // Check if user has a token_usage record
    const { data: existing } = await supabase
      .from('token_usage')
      .select('id, used')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from('token_usage')
        .update({
          used: (existing.used || 0) + tokensUsed,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) {
        console.error('Failed to update token usage:', error)
      }
    } else {
      // Create new record
      const now = new Date()
      const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1) // First of next month
      
      const { error } = await supabase
        .from('token_usage')
        .insert({
          user_id: user.id,
          used: tokensUsed,
          limit_amount: 1_000_000,
          reset_date: resetDate.toISOString().split('T')[0],
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })

      if (error) {
        console.error('Failed to create token usage record:', error)
      }
    }
  } catch (err) {
    console.error('Token usage update error:', err)
  }
}



// Increment token usage - adds tokens to daily history and total
export async function incrementTokenUsage(tokens: number): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.error('No user found for token usage increment')
      return
    }

    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // Update the main token_usage record
    await updateTokenUsage(tokens)

    // Also update usage_history for daily tracking
    const { data: existing } = await supabase
      .from('usage_history')
      .select('id, tokens_used')
      .eq('user_id', user.id)
      .eq('date', today)
      .single()

    if (existing) {
      await supabase
        .from('usage_history')
        .update({
          tokens_used: (existing.tokens_used || 0) + tokens,
        })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('usage_history')
        .insert({
          user_id: user.id,
          date: today,
          tokens_used: tokens,
        })
    }
  } catch (err) {
    console.error('Increment token usage error:', err)
  }
}

// Get usage history for the last N days
export async function getUsageHistory(days: number = 7): Promise<UsageHistoryItem[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return []
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('usage_history')
      .select('date, tokens_used')
      .eq('user_id', user.id)
      .gte('date', startDateStr)
      .order('date', { ascending: true })

    if (error || !data) {
      console.error('Failed to fetch usage history:', error)
      return []
    }

    // Fill in missing days with 0
    const result: UsageHistoryItem[] = []
    const endDate = new Date()
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      const found = data.find(item => item.date === dateStr)
      result.push({
        date: dateStr,
        tokens_used: found?.tokens_used || 0,
      })
    }

    return result
  } catch (err) {
    console.error('Usage history fetch error:', err)
    return []
  }
}

// ============================================
// Gateway Connection Functions
// ============================================

import type { GatewayConnection, GatewayConnectionInput, GatewayStatus } from '@/types/gateway'

// LocalStorage key for mock fallback
const GATEWAY_STORAGE_KEY = 'openclaw_gateway_connection'

// Mock gateway for fallback
function getMockGateway(userId: string): GatewayConnection | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem(GATEWAY_STORAGE_KEY)
    if (!stored) return null
    
    const data = JSON.parse(stored)
    if (data.user_id !== userId) return null
    
    return data as GatewayConnection
  } catch {
    return null
  }
}

function saveMockGateway(gateway: GatewayConnection): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(GATEWAY_STORAGE_KEY, JSON.stringify(gateway))
}

function deleteMockGateway(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(GATEWAY_STORAGE_KEY)
}

// Fetch user's gateway connection with mock fallback
export async function getUserGateway(userId: string): Promise<GatewayConnection | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('user_gateways')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      // Fall back to localStorage mock
      return getMockGateway(userId)
    }

    return {
      id: data.id,
      user_id: data.user_id,
      gateway_url: data.gateway_url,
      auth_token: data.auth_token,
      name: data.name,
      status: data.status as GatewayStatus,
      last_ping: data.last_ping,
      created_at: data.created_at,
      updated_at: data.updated_at,
    }
  } catch {
    // Fall back to localStorage mock
    return getMockGateway(userId)
  }
}

// Save/upsert user's gateway connection with mock fallback
export async function saveUserGateway(
  userId: string, 
  input: GatewayConnectionInput
): Promise<GatewayConnection> {
  const now = new Date().toISOString()
  
  try {
    const supabase = await createClient()
    
    // Check if user already has a gateway connection
    const { data: existing } = await supabase
      .from('user_gateways')
      .select('id')
      .eq('user_id', userId)
      .single()

    let data
    
    if (existing) {
      // Update existing
      const { data: updated, error } = await supabase
        .from('user_gateways')
        .update({
          gateway_url: input.gateway_url,
          auth_token: input.auth_token,
          name: input.name || 'My OpenClaw',
          status: 'connected',
          updated_at: now,
        })
        .eq('id', existing.id)
        .select()
        .single()
      
      if (error) throw error
      data = updated
    } else {
      // Insert new
      const { data: inserted, error } = await supabase
        .from('user_gateways')
        .insert({
          user_id: userId,
          gateway_url: input.gateway_url,
          auth_token: input.auth_token,
          name: input.name || 'My OpenClaw',
          status: 'connected',
          created_at: now,
          updated_at: now,
        })
        .select()
        .single()
      
      if (error) throw error
      data = inserted
    }

    return {
      id: data.id,
      user_id: data.user_id,
      gateway_url: data.gateway_url,
      auth_token: data.auth_token,
      name: data.name,
      status: data.status as GatewayStatus,
      last_ping: data.last_ping,
      created_at: data.created_at,
      updated_at: data.updated_at,
    }
  } catch {
    // Fall back to localStorage mock
    const mockGateway: GatewayConnection = {
      id: "mock_" + Date.now(),
      user_id: userId,
      gateway_url: input.gateway_url,
      auth_token: input.auth_token,
      name: input.name || 'My OpenClaw',
      status: 'connected',
      last_ping: null,
      created_at: now,
      updated_at: now,
    }
    saveMockGateway(mockGateway)
    return mockGateway
  }
}

// Delete user's gateway connection with mock fallback
export async function deleteUserGateway(userId: string): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase
      .from('user_gateways')
      .delete()
      .eq('user_id', userId)
  } catch {
    // Fall back to localStorage mock deletion
  }
  
  // Always also clear mock (in case it was used as fallback)
  deleteMockGateway()
}

// ============================================
// Integration Sync Functions
// ============================================

/**
 * Upsert integrations from gateway sync
 */
export async function upsertIntegrations(
  userId: string,
  integrations: Integration[]
): Promise<Integration[]> {
  const now = new Date().toISOString();
  const results: Integration[] = [];

  try {
    const supabase = await createClient();

    for (const integration of integrations) {
      const { data: existing } = await supabase
        .from("integrations")
        .select("id")
        .eq("user_id", userId)
        .eq("slug", integration.slug)
        .single();

      let result;

      if (existing) {
        const { data, error } = await supabase
          .from("integrations")
          .update({
            name: integration.name,
            icon: integration.icon,
            type: integration.type,
            status: integration.status,
            config: integration.config,
            accounts: integration.accounts,
            last_sync: now,
            updated_at: now,
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) {
          console.error("Failed to update integration " + integration.slug + ":", error);
          continue;
        }
        result = data;
      } else {
        const { data, error } = await supabase
          .from("integrations")
          .insert({
            user_id: userId,
            name: integration.name,
            slug: integration.slug,
            icon: integration.icon,
            type: integration.type,
            status: integration.status,
            config: integration.config,
            accounts: integration.accounts,
            last_sync: now,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (error) {
          console.error("Failed to insert integration " + integration.slug + ":", error);
          continue;
        }
        result = data;
      }

      if (result) {
        results.push({
          id: result.id,
          user_id: result.user_id,
          name: result.name,
          slug: result.slug,
          icon: result.icon,
          type: result.type as IntegrationType,
          status: result.status as IntegrationStatus,
          config: result.config || {},
          accounts: (result.accounts || []) as IntegrationAccount[],
          last_sync: result.last_sync,
          created_at: result.created_at,
          updated_at: result.updated_at,
        });
      }
    }

    return results;
  } catch (err) {
    console.error("Error upserting integrations:", err);
    return integrations.map(i => ({
      ...i,
      user_id: userId,
      last_sync: now,
      created_at: now,
      updated_at: now,
    }));
  }
}

// ============================================
// Instructions Functions
// ============================================

/**
 * Get user's instructions
 */
export async function getInstructions(): Promise<string> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return "";
    }

    const { data, error } = await supabase
      .from("instructions")
      .select("content")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Failed to fetch instructions:", error);
      return "";
    }

    return data?.content || "";
  } catch (err) {
    console.error("Instructions fetch error:", err);
    return "";
  }
}

/**
 * Save user's instructions
 */
export async function saveInstructions(content: string): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const now = new Date().toISOString();

    // Check if user already has instructions
    const { data: existing } = await supabase
      .from("instructions")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("instructions")
        .update({
          content,
          updated_at: now,
        })
        .eq("id", existing.id);

      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabase
        .from("instructions")
        .insert({
          user_id: user.id,
          content,
          created_at: now,
          updated_at: now,
        });

      if (error) {
        throw error;
      }
    }
  } catch (err) {
    console.error("Failed to save instructions:", err);
    throw err;
  }
}

// ============================================
// Workflow Run Functions
// ============================================

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: Record<string, unknown>;
  started_at: string;
  completed_at?: string;
}

/**
 * Create a new workflow run record
 */
export async function createWorkflowRun(
  workflowId: string,
  status: 'pending' | 'running' | 'completed' | 'failed' = 'pending'
): Promise<WorkflowRun> {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('workflow_runs')
      .insert({
        workflow_id: workflowId,
        status,
        started_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create workflow run:', error);
      throw error;
    }

    return {
      id: data.id,
      workflow_id: data.workflow_id,
      status: data.status,
      output: data.output,
      started_at: data.started_at,
      completed_at: data.completed_at,
    };
  } catch (err) {
    console.error('Create workflow run error:', err);
    throw err;
  }
}

/**
 * Update a workflow run status and optionally output
 */
export async function updateWorkflowRun(
  runId: string,
  status: 'pending' | 'running' | 'completed' | 'failed',
  output?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = { status };
    
    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = now;
    }
    
    if (output !== undefined) {
      updateData.output = output;
    }

    const { error } = await supabase
      .from('workflow_runs')
      .update(updateData)
      .eq('id', runId);

    if (error) {
      console.error('Failed to update workflow run:', error);
      throw error;
    }
  } catch (err) {
    console.error('Update workflow run error:', err);
    throw err;
  }
}

/**
 * Get workflow runs for a specific workflow
 */
export async function getWorkflowRuns(
  workflowId: string,
  limit: number = 10
): Promise<WorkflowRun[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('workflow_runs')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch workflow runs:', error);
      return [];
    }

    return (data || []).map((r) => ({
      id: r.id,
      workflow_id: r.workflow_id,
      status: r.status,
      output: r.output,
      started_at: r.started_at,
      completed_at: r.completed_at,
    }));
  } catch (err) {
    console.error('Get workflow runs error:', err);
    return [];
  }
}

/**
 * Get a single workflow by ID
 */
export async function getWorkflowById(workflowId: string): Promise<Workflow | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (error || !data) {
      console.error('Failed to fetch workflow:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      status: data.status || 'active',
      lastRun: data.last_run || 'Never',
      icon: data.icon || 'Zap',
    };
  } catch (err) {
    console.error('Get workflow by ID error:', err);
    return null;
  }
}

/**
 * Update workflow's last_run timestamp
 */
export async function updateWorkflowLastRun(workflowId: string): Promise<void> {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('workflows')
      .update({ 
        last_run: now,
        updated_at: now,
      })
      .eq('id', workflowId);

    if (error) {
      console.error('Failed to update workflow last_run:', error);
    }
  } catch (err) {
    console.error('Update workflow last_run error:', err);
  }
}

// ============================================
// Workflow CRUD Functions
// ============================================

export interface WorkflowInput {
  name: string;
  description: string;
  icon?: string;
  status?: "active" | "inactive" | "pending";
  trigger_type?: "manual" | "scheduled" | "webhook";
  schedule?: {
    frequency: "daily" | "weekly" | "monthly" | "custom";
    cronExpression?: string;
    time?: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
  };
}

/**
 * Create a new workflow
 */
export async function createWorkflow(workflow: WorkflowInput): Promise<Workflow> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('workflows')
      .insert({
        user_id: user.id,
        name: workflow.name,
        description: workflow.description,
        icon: workflow.icon || 'Zap',
        status: workflow.status || 'inactive',
        trigger_type: workflow.trigger_type || 'manual',
        schedule: workflow.schedule || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to create workflow:', error);
      throw new Error(error?.message || 'Failed to create workflow');
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      status: data.status || 'inactive',
      lastRun: data.last_run || 'Never',
      icon: data.icon || 'Zap',
    };
  } catch (err) {
    console.error('Create workflow error:', err);
    throw err;
  }
}

/**
 * Update an existing workflow
 */
export async function updateWorkflow(
  id: string,
  workflow: Partial<WorkflowInput>
): Promise<Workflow> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('workflows')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== user.id) {
      throw new Error('Workflow not found or access denied');
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      updated_at: now,
    };

    if (workflow.name !== undefined) updateData.name = workflow.name;
    if (workflow.description !== undefined) updateData.description = workflow.description;
    if (workflow.icon !== undefined) updateData.icon = workflow.icon;
    if (workflow.status !== undefined) updateData.status = workflow.status;
    if (workflow.trigger_type !== undefined) updateData.trigger_type = workflow.trigger_type;
    if (workflow.schedule !== undefined) updateData.schedule = workflow.schedule;

    const { data, error } = await supabase
      .from('workflows')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to update workflow:', error);
      throw new Error(error?.message || 'Failed to update workflow');
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      status: data.status || 'inactive',
      lastRun: data.last_run || 'Never',
      icon: data.icon || 'Zap',
    };
  } catch (err) {
    console.error('Update workflow error:', err);
    throw err;
  }
}

/**
 * Delete a workflow
 */
export async function deleteWorkflow(id: string): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('workflows')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!existing || existing.user_id !== user.id) {
      throw new Error('Workflow not found or access denied');
    }

    // Delete associated workflow runs first
    await supabase
      .from('workflow_runs')
      .delete()
      .eq('workflow_id', id);

    // Delete the workflow
    const { error } = await supabase
      .from('workflows')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete workflow:', error);
      throw new Error(error.message || 'Failed to delete workflow');
    }
  } catch (err) {
    console.error('Delete workflow error:', err);
    throw err;
  }
}

/**
 * Get a single workflow by ID (alias for getWorkflowById)
 */
export async function getWorkflow(id: string): Promise<Workflow | null> {
  return getWorkflowById(id);
}

// ============================================
// UserProfile Functions
// ============================================

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  plan: string;
  plan_status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  instance_id: string | null;
  gateway_url: string | null;
  auth_token: string | null;
  instance_status: string;
  instance_settings: Record<string, unknown>;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
  // Backward-compat aliases (deprecated)
  openclaw_instance_id?: string | null;
  openclaw_gateway_url?: string | null;
  openclaw_auth_token?: string | null;
  openclaw_status?: string;
}

/**
 * Get the user's profile — replaces getOrganization.
 * Reads instance + billing data directly from the profiles table.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error || !data) return null;
    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name,
      avatar_url: data.avatar_url,
      plan: data.plan || "free",
      plan_status: data.plan_status || "active",
      stripe_customer_id: data.stripe_customer_id,
      stripe_subscription_id: data.stripe_subscription_id,
      current_period_end: data.current_period_end,
      instance_id: data.instance_id,
      gateway_url: data.gateway_url,
      auth_token: data.auth_token,
      instance_status: data.instance_status || "not_provisioned",
      instance_settings: data.instance_settings || {},
      onboarding_completed: data.onboarding_completed || false,
      created_at: data.created_at,
      updated_at: data.updated_at,
      // Backward-compat aliases
      openclaw_instance_id: data.instance_id,
      openclaw_gateway_url: data.gateway_url,
      openclaw_auth_token: data.auth_token,
      openclaw_status: data.instance_status || "not_provisioned",
    };
  } catch (err) {
    console.error("Get user profile error:", err);
    return null;
  }
}

/** @deprecated Use getUserProfile instead */
export const getOrganization = getUserProfile;
/** @deprecated Use UserProfile instead */
export type Organization = UserProfile;


// ============ CRON JOBS ============

export interface CronJob {
  id: string;
  user_id: string;
  workflow_id: string | null;
  name: string;
  description: string | null;
  schedule: string;
  prompt: string;
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_output: string | null;
  next_run_at: string | null;
  run_count: number;
  created_at: string;
  updated_at: string;
}

export async function getCronJobs(userId: string): Promise<CronJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cron_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.error('getCronJobs error:', error); return []; }
  return data || [];
}

export async function createCronJob(userId: string, job: Omit<CronJob, 'id' | 'user_id' | 'run_count' | 'last_run_at' | 'last_run_status' | 'last_run_output' | 'next_run_at' | 'created_at' | 'updated_at'>): Promise<CronJob | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cron_jobs')
    .insert({ ...job, user_id: userId })
    .select()
    .single();
  if (error) { console.error('createCronJob error:', error); return null; }
  return data;
}

export async function updateCronJob(id: string, updates: Partial<CronJob>): Promise<CronJob | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cron_jobs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('updateCronJob error:', error); return null; }
  return data;
}

export async function deleteCronJob(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from('cron_jobs').delete().eq('id', id);
  if (error) { console.error('deleteCronJob error:', error); return false; }
  return true;
}
