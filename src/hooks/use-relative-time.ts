"use client";

import { useState, useEffect } from "react";

/**
 * Hook to calculate relative time on the client side only
 * Avoids hydration mismatch by returning a placeholder during SSR
 */
export function useRelativeTime(date: string | Date): string {
  const [relativeTime, setRelativeTime] = useState<string>("");

  useEffect(() => {
    function calculateRelativeTime(): string {
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
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[targetDate.getMonth()]} ${targetDate.getDate()}`;
    }

    setRelativeTime(calculateRelativeTime());
    
    // Update every minute
    const interval = setInterval(() => {
      setRelativeTime(calculateRelativeTime());
    }, 60000);
    
    return () => clearInterval(interval);
  }, [date]);

  return relativeTime;
}

/**
 * Hook to check if mounted on client (for conditional rendering)
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  
  useEffect(() => {
    setHydrated(true);
  }, []);
  
  return hydrated;
}
