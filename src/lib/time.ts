/**
 * Time formatting utilities for displaying relative timestamps
 */

/**
 * Format a date as a relative time string
 * @param date - The date to format (string or Date object)
 * @returns A human-readable relative time string
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  
  // Handle invalid dates
  if (isNaN(targetDate.getTime())) {
    return 'Unknown';
  }
  
  const diffMs = now.getTime() - targetDate.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  // Just now (< 1 minute)
  if (diffSeconds < 60) {
    return 'just now';
  }
  
  // Minutes ago (1-59 minutes)
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 min ago' : `${diffMinutes} min ago`;
  }
  
  // Hours ago (1-23 hours)
  if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  
  // Yesterday
  if (diffDays === 1) {
    return 'yesterday';
  }
  
  // Days ago (2-6 days)
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  
  // Format as date for older entries (e.g., "Mar 6")
  return formatShortDate(targetDate);
}

/**
 * Format a date as a short date string (e.g., "Mar 6")
 * @param date - The date to format
 * @returns A short date string
 */
export function formatShortDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Format a date as a full date string (e.g., "March 6, 2024")
 * @param date - The date to format (string or Date object)
 * @returns A full date string
 */
export function formatFullDate(date: string | Date): string {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(targetDate.getTime())) {
    return 'Unknown';
  }
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[targetDate.getMonth()]} ${targetDate.getDate()}, ${targetDate.getFullYear()}`;
}

/**
 * Format a date with time (e.g., "Mar 6 at 2:30 PM")
 * @param date - The date to format (string or Date object)
 * @returns A date with time string
 */
export function formatDateWithTime(date: string | Date): string {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(targetDate.getTime())) {
    return 'Unknown';
  }
  
  const shortDate = formatShortDate(targetDate);
  const hours = targetDate.getHours();
  const minutes = targetDate.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  const minuteStr = minutes.toString().padStart(2, '0');
  
  return `${shortDate} at ${hour12}:${minuteStr} ${ampm}`;
}

/**
 * Get the start of a time range
 * @param range - The range type: 'today', 'week', 'month', 'all'
 * @returns A Date object representing the start of the range, or null for 'all'
 */
export function getDateRangeStart(range: 'today' | 'week' | 'month' | 'all'): Date | null {
  const now = new Date();
  
  switch (range) {
    case 'today':
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      return today;
    
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);
      return weekStart;
    
    case 'month':
      const monthStart = new Date(now);
      monthStart.setDate(monthStart.getDate() - 30);
      monthStart.setHours(0, 0, 0, 0);
      return monthStart;
    
    case 'all':
    default:
      return null;
  }
}
