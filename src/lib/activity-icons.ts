import {
  Zap,
  MessageSquare,
  Plug,
  Brain,
  Link,
  Activity,
  Settings,
  FileText,
  User,
  LogIn,
  LogOut,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';

/**
 * Map activity action strings to Lucide icons
 * @param action - The activity action string
 * @returns The appropriate Lucide icon component
 */
export function getActivityIcon(action: string): LucideIcon {
  const lowerAction = action.toLowerCase();
  
  // Workflow related
  if (lowerAction.includes('workflow')) {
    return Zap;
  }
  
  // Chat/Message related
  if (lowerAction.includes('chat') || lowerAction.includes('message') || lowerAction.includes('conversation')) {
    return MessageSquare;
  }
  
  // Integration related
  if (lowerAction.includes('integration') || lowerAction.includes('connect') || lowerAction.includes('sync')) {
    return Plug;
  }
  
  // Memory related
  if (lowerAction.includes('memory') || lowerAction.includes('knowledge')) {
    return Brain;
  }
  
  // Gateway related
  if (lowerAction.includes('gateway')) {
    return Link;
  }
  
  // Settings related
  if (lowerAction.includes('setting') || lowerAction.includes('config') || lowerAction.includes('preference')) {
    return Settings;
  }
  
  // Instructions related
  if (lowerAction.includes('instruction')) {
    return FileText;
  }
  
  // Authentication related
  if (lowerAction.includes('login') || lowerAction.includes('sign in')) {
    return LogIn;
  }
  
  if (lowerAction.includes('logout') || lowerAction.includes('sign out')) {
    return LogOut;
  }
  
  // CRUD operations
  if (lowerAction.includes('created') || lowerAction.includes('added') || lowerAction.includes('new')) {
    return Plus;
  }
  
  if (lowerAction.includes('deleted') || lowerAction.includes('removed')) {
    return Trash2;
  }
  
  if (lowerAction.includes('updated') || lowerAction.includes('edited') || lowerAction.includes('modified') || lowerAction.includes('saved')) {
    return Edit;
  }
  
  // Profile/Account related
  if (lowerAction.includes('profile') || lowerAction.includes('account')) {
    return User;
  }
  
  // Refresh/Sync
  if (lowerAction.includes('refresh') || lowerAction.includes('reload')) {
    return RefreshCw;
  }
  
  // Default
  return Activity;
}

/**
 * Get the activity type category from an action string
 * @param action - The activity action string
 * @returns The category string
 */
export function getActivityCategory(action: string): 'workflow' | 'chat' | 'integration' | 'memory' | 'settings' | 'other' {
  const lowerAction = action.toLowerCase();
  
  if (lowerAction.includes('workflow')) return 'workflow';
  if (lowerAction.includes('chat') || lowerAction.includes('message') || lowerAction.includes('conversation')) return 'chat';
  if (lowerAction.includes('integration') || lowerAction.includes('gateway') || lowerAction.includes('connect')) return 'integration';
  if (lowerAction.includes('memory') || lowerAction.includes('instruction')) return 'memory';
  if (lowerAction.includes('setting') || lowerAction.includes('config') || lowerAction.includes('preference')) return 'settings';
  
  return 'other';
}

/**
 * Activity type colors based on category
 */
export const activityColors: Record<string, string> = {
  workflow: '#1A3C2B', // forest
  chat: '#FF8C69', // coral
  integration: '#9EFFBF', // mint
  memory: '#F4D35E', // gold
  settings: '#3A3A38', // grid
  other: '#3A3A38', // grid
};

/**
 * Get the color for an activity based on its action
 * @param action - The activity action string
 * @returns The hex color string
 */
export function getActivityColor(action: string): string {
  const category = getActivityCategory(action);
  return activityColors[category] || activityColors.other;
}
