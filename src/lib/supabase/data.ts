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
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .order('name')

    if (error || !data) {
      console.error('Failed to fetch integrations:', error)
      return []
    }

    return data.map((i): Integration => ({
      id: i.id,
      user_id: i.user_id,
      name: i.name,
      slug: i.slug,
      icon: i.icon || '🔗',
      type: i.type as IntegrationType,
      status: i.status as IntegrationStatus,
      config: i.config || {},
      accounts: (i.accounts || []) as IntegrationAccount[],
      last_sync: i.last_sync,
      created_at: i.created_at,
      updated_at: i.updated_at,
    }))
  } catch (err) {
    console.error('Integrations fetch error:', err)
    return []
  }
}

// Fetch conversations - returns empty array if none
export async function getConversations(): Promise<Conversation[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })

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
export async function getMessages(conversationId?: string): Promise<Message[]> {
  try {
    const supabase = await createClient()
    let query = supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })

    if (conversationId) {
      query = query.eq('conversation_id', conversationId)
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

// Fetch team members - returns empty array if none
export async function getTeamMembers(): Promise<TeamMember[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .order('created_at')

    if (error || !data) {
      console.error('Failed to fetch team members:', error)
      return []
    }

    return data.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
    }))
  } catch (err) {
    console.error('Team members fetch error:', err)
    return []
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
      limit: data.token_limit || 1_000_000,
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
          token_limit: 1_000_000,
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
// Onboarding Functions
// ============================================

const ONBOARDING_STORAGE_KEY = "openclaw_onboarding_state";

/**
 * Check if user has completed onboarding
 * Checks Supabase first, falls back to localStorage
 */
export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Not logged in - check localStorage
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (stored) {
          const data = JSON.parse(stored);
          return data.completedAt !== null;
        }
      }
      return false;
    }

    // Check Supabase profile
    const { data } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();

    if (data?.onboarding_completed) {
      return true;
    }

    // Fallback to localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (stored) {
        const localData = JSON.parse(stored);
        return localData.completedAt !== null;
      }
    }

    return false;
  } catch {
    // Error - check localStorage
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (stored) {
          const data = JSON.parse(stored);
          return data.completedAt !== null;
        }
      } catch {
        // Ignore
      }
    }
    return false;
  }
}

/**
 * Mark onboarding as complete
 * Saves to Supabase and localStorage
 */
export async function completeOnboarding(): Promise<void> {
  const now = new Date().toISOString();

  // Save to localStorage first (always works)
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : {};
      data.completedAt = now;
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore
    }
  }

  // Try to save to Supabase
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          onboarding_completed: true,
          onboarding_completed_at: now,
          updated_at: now,
        }, {
          onConflict: "id",
        });
    }
  } catch {
    // Ignore - localStorage is enough
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
// Team Management Functions
// ============================================

export interface TeamMemberWithRole {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  user_id: string;
  accepted_at: string | null;
}

export interface TeamInvitationRecord {
  id: string;
  email: string;
  role: string;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

/**
 * Get team members and pending invitations for an organization
 */
export async function getTeamMembersWithInvitations(userId: string): Promise<{
  members: TeamMemberWithRole[];
  invitations: TeamInvitationRecord[];
  currentUserRole: "owner" | "admin" | "member";
}> {
  try {
    const supabase = await createClient();
    
    // Get user's org_id first
    const { data: userMembership } = await supabase
      .from("team_members")
      .select("org_id, role")
      .eq("user_id", userId)
      .single();

    if (!userMembership) {
      // User is not part of any team, create a default org for them
      const orgId = userId; // Use user ID as org ID for simplicity
      
      // Create owner membership
      await supabase.from("team_members").insert({
        org_id: orgId,
        user_id: userId,
        email: "",
        name: "",
        role: "owner",
        accepted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
      
      return {
        members: [],
        invitations: [],
        currentUserRole: "owner",
      };
    }

    const orgId = userMembership.org_id;
    const currentUserRole = userMembership.role as "owner" | "admin" | "member";

    // Get all team members for this org
    const { data: membersData, error: membersError } = await supabase
      .from("team_members")
      .select("*")
      .eq("org_id", orgId)
      .not("accepted_at", "is", null)
      .order("created_at");

    if (membersError) {
      console.error("Failed to fetch team members:", membersError);
    }

    // Get pending invitations
    const { data: invitationsData, error: invitationsError } = await supabase
      .from("team_invitations")
      .select("*")
      .eq("org_id", orgId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (invitationsError) {
      console.error("Failed to fetch invitations:", invitationsError);
    }

    const members: TeamMemberWithRole[] = (membersData || []).map((m) => ({
      id: m.id,
      name: m.name || "",
      email: m.email || "",
      role: m.role as "owner" | "admin" | "member",
      user_id: m.user_id,
      accepted_at: m.accepted_at,
    }));

    const invitations: TeamInvitationRecord[] = (invitationsData || []).map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      invited_by: i.invited_by,
      token: i.token,
      expires_at: i.expires_at,
      accepted_at: i.accepted_at,
      created_at: i.created_at,
    }));

    return {
      members,
      invitations,
      currentUserRole,
    };
  } catch (err) {
    console.error("Get team members error:", err);
    return {
      members: [],
      invitations: [],
      currentUserRole: "member",
    };
  }
}

/**
 * Invite a new team member
 */
export async function inviteTeamMember(
  userId: string,
  email: string,
  role: string
): Promise<TeamInvitationRecord> {
  const supabase = await createClient();
  
  // Get user's org_id
  const { data: userMembership } = await supabase
    .from("team_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .single();

  if (!userMembership) {
    throw new Error("User is not part of any organization");
  }

  // Check permission
  if (!["owner", "admin"].includes(userMembership.role)) {
    throw new Error("You do not have permission to invite members");
  }

  const orgId = userMembership.org_id;

  // Check if email is already a member
  const { data: existingMember } = await supabase
    .from("team_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("email", email)
    .single();

  if (existingMember) {
    throw new Error("This email is already a team member");
  }

  // Check if there's already a pending invitation
  const { data: existingInvitation } = await supabase
    .from("team_invitations")
    .select("id")
    .eq("org_id", orgId)
    .eq("email", email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (existingInvitation) {
    throw new Error("An invitation has already been sent to this email");
  }

  // Generate unique token
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  const { data, error } = await supabase
    .from("team_invitations")
    .insert({
      org_id: orgId,
      email,
      role,
      invited_by: userId,
      token,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create invitation:", error);
    throw new Error("Failed to send invitation");
  }

  return {
    id: data.id,
    email: data.email,
    role: data.role,
    invited_by: data.invited_by,
    token: data.token,
    expires_at: data.expires_at,
    accepted_at: data.accepted_at,
    created_at: data.created_at,
  };
}

/**
 * Update a member's role
 */
export async function updateMemberRole(
  userId: string,
  memberId: string,
  newRole: string
): Promise<void> {
  const supabase = await createClient();
  
  // Get user's org_id and role
  const { data: userMembership } = await supabase
    .from("team_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .single();

  if (!userMembership) {
    throw new Error("User is not part of any organization");
  }

  // Only owners can change roles
  if (userMembership.role !== "owner") {
    throw new Error("Only owners can change member roles");
  }

  const orgId = userMembership.org_id;

  // Get the target member
  const { data: targetMember } = await supabase
    .from("team_members")
    .select("id, role, user_id")
    .eq("id", memberId)
    .eq("org_id", orgId)
    .single();

  if (!targetMember) {
    throw new Error("Member not found");
  }

  // Cannot change owner's role
  if (targetMember.role === "owner") {
    throw new Error("Cannot change the owner's role");
  }

  // Cannot change your own role
  if (targetMember.user_id === userId) {
    throw new Error("Cannot change your own role");
  }

  const { error } = await supabase
    .from("team_members")
    .update({
      role: newRole,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberId);

  if (error) {
    console.error("Failed to update role:", error);
    throw new Error("Failed to update role");
  }
}

/**
 * Remove a member from the team
 */
export async function removeMember(userId: string, memberId: string): Promise<void> {
  const supabase = await createClient();
  
  // Get user's org_id and role
  const { data: userMembership } = await supabase
    .from("team_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .single();

  if (!userMembership) {
    throw new Error("User is not part of any organization");
  }

  // Only owners and admins can remove members
  if (!["owner", "admin"].includes(userMembership.role)) {
    throw new Error("You do not have permission to remove members");
  }

  const orgId = userMembership.org_id;

  // Get the target member
  const { data: targetMember } = await supabase
    .from("team_members")
    .select("id, role, user_id")
    .eq("id", memberId)
    .eq("org_id", orgId)
    .single();

  if (!targetMember) {
    throw new Error("Member not found");
  }

  // Cannot remove owner
  if (targetMember.role === "owner") {
    throw new Error("Cannot remove the owner");
  }

  // Admins cannot remove other admins
  if (userMembership.role === "admin" && targetMember.role === "admin") {
    throw new Error("Admins cannot remove other admins");
  }

  // Cannot remove yourself
  if (targetMember.user_id === userId) {
    throw new Error("Cannot remove yourself");
  }

  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("id", memberId);

  if (error) {
    console.error("Failed to remove member:", error);
    throw new Error("Failed to remove member");
  }
}

/**
 * Cancel a pending invitation
 */
export async function cancelInvitation(userId: string, invitationId: string): Promise<void> {
  const supabase = await createClient();
  
  // Get user's org_id and role
  const { data: userMembership } = await supabase
    .from("team_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .single();

  if (!userMembership) {
    throw new Error("User is not part of any organization");
  }

  // Only owners and admins can cancel invitations
  if (!["owner", "admin"].includes(userMembership.role)) {
    throw new Error("You do not have permission to cancel invitations");
  }

  const orgId = userMembership.org_id;

  // Verify invitation belongs to this org
  const { data: invitation } = await supabase
    .from("team_invitations")
    .select("id")
    .eq("id", invitationId)
    .eq("org_id", orgId)
    .single();

  if (!invitation) {
    throw new Error("Invitation not found");
  }

  const { error } = await supabase
    .from("team_invitations")
    .delete()
    .eq("id", invitationId);

  if (error) {
    console.error("Failed to cancel invitation:", error);
    throw new Error("Failed to cancel invitation");
  }
}

/**
 * Get invitation by token (for acceptance page)
 */
export async function getInvitationByToken(token: string): Promise<{
  invitation: TeamInvitationRecord | null;
  inviterName: string | null;
  expired: boolean;
}> {
  try {
    const supabase = await createClient();
    
    const { data: invitation, error } = await supabase
      .from("team_invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !invitation) {
      return { invitation: null, inviterName: null, expired: false };
    }

    // Check if expired
    const expired = new Date(invitation.expires_at) < new Date();
    
    // Check if already accepted
    if (invitation.accepted_at) {
      return { invitation: null, inviterName: null, expired: false };
    }

    // Get inviter name
    const { data: inviter } = await supabase
      .from("team_members")
      .select("name, email")
      .eq("user_id", invitation.invited_by)
      .single();

    const inviterName = inviter?.name || inviter?.email || "Someone";

    return {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        invited_by: invitation.invited_by,
        token: invitation.token,
        expires_at: invitation.expires_at,
        accepted_at: invitation.accepted_at,
        created_at: invitation.created_at,
      },
      inviterName,
      expired,
    };
  } catch (err) {
    console.error("Get invitation by token error:", err);
    return { invitation: null, inviterName: null, expired: false };
  }
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(token: string, userId: string): Promise<void> {
  const supabase = await createClient();
  
  // Get the invitation
  const { data: invitation, error: invError } = await supabase
    .from("team_invitations")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .single();

  if (invError || !invitation) {
    throw new Error("Invalid or expired invitation");
  }

  // Check if expired
  if (new Date(invitation.expires_at) < new Date()) {
    throw new Error("This invitation has expired");
  }

  // Get user email
  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email || invitation.email;

  // Check if user is already a member of this org
  const { data: existingMember } = await supabase
    .from("team_members")
    .select("id")
    .eq("org_id", invitation.org_id)
    .eq("user_id", userId)
    .single();

  if (existingMember) {
    throw new Error("You are already a member of this team");
  }

  const now = new Date().toISOString();

  // Create team member record
  const { error: memberError } = await supabase
    .from("team_members")
    .insert({
      org_id: invitation.org_id,
      user_id: userId,
      email: userEmail,
      name: user?.user_metadata?.full_name || "",
      role: invitation.role,
      invited_by: invitation.invited_by,
      accepted_at: now,
      created_at: now,
    });

  if (memberError) {
    console.error("Failed to create member:", memberError);
    throw new Error("Failed to join team");
  }

  // Mark invitation as accepted
  await supabase
    .from("team_invitations")
    .update({
      accepted_at: now,
    })
    .eq("id", invitation.id);
}

/**
 * Decline an invitation
 */
export async function declineInvitation(token: string): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("team_invitations")
    .delete()
    .eq("token", token);

  if (error) {
    console.error("Failed to decline invitation:", error);
    throw new Error("Failed to decline invitation");
  }
}

// ============================================
// Organization Functions
// ============================================

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  owner_id: string;
  plan: string;
  openclaw_instance_id: string | null;
  openclaw_gateway_url: string | null;
  openclaw_auth_token: string | null;
  openclaw_status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get the user's organization
 */
export async function getOrganization(userId: string): Promise<Organization | null> {
  try {
    const supabase = await createClient();
    
    console.log("[getOrganization] Fetching for userId:", userId);
    
    // Use limit(1) instead of single() to handle multiple orgs gracefully
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    console.log("[getOrganization] Result:", { data, error });

    if (error) {
      console.error("getOrganization query error:", error);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.log("[getOrganization] No organizations found");
      return null;
    }
    
    const org = data[0];

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      owner_id: org.owner_id,
      plan: org.plan || "starter",
      openclaw_instance_id: org.openclaw_instance_id,
      openclaw_gateway_url: org.openclaw_gateway_url,
      openclaw_auth_token: org.openclaw_auth_token,
      openclaw_status: org.openclaw_status || "not_provisioned",
      created_at: org.created_at,
      updated_at: org.updated_at,
    };
  } catch (err) {
    console.error("Get organization error:", err);
    return null;
  }
}

/**
 * Create a new organization for the user
 */
export async function createOrganization(name: string): Promise<Organization> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Generate slug from name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name,
      slug: slug || `org-${Date.now()}`,
      owner_id: user.id,
      plan: "starter",
      openclaw_status: "not_provisioned",
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Failed to create organization:", error);
    throw new Error(error?.message || "Failed to create organization");
  }

  // Update user's profile with organization_id
  await supabase
    .from("profiles")
    .update({ organization_id: data.id })
    .eq("id", user.id);

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    owner_id: data.owner_id,
    plan: data.plan || "starter",
    openclaw_instance_id: data.openclaw_instance_id,
    openclaw_gateway_url: data.openclaw_gateway_url,
    openclaw_auth_token: data.openclaw_auth_token,
    openclaw_status: data.openclaw_status || "not_provisioned",
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Update organization with gateway details
 */
export async function updateOrganizationGateway(
  orgId: string,
  gatewayUrl: string,
  authToken: string
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  // Verify ownership
  const { data: org } = await supabase
    .from("organizations")
    .select("owner_id")
    .eq("id", orgId)
    .single();

  if (!org || org.owner_id !== user.id) {
    throw new Error("Organization not found or access denied");
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      openclaw_gateway_url: gatewayUrl,
      openclaw_auth_token: authToken,
      openclaw_status: "connected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (error) {
    console.error("Failed to update organization gateway:", error);
    throw new Error(error.message || "Failed to update gateway");
  }
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(orgId: string): Promise<Organization | null> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      owner_id: data.owner_id,
      plan: data.plan || "starter",
      openclaw_instance_id: data.openclaw_instance_id,
      openclaw_gateway_url: data.openclaw_gateway_url,
      openclaw_auth_token: data.openclaw_auth_token,
      openclaw_status: data.openclaw_status || "not_provisioned",
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  } catch (err) {
    console.error("Get organization by ID error:", err);
    return null;
  }
}

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
