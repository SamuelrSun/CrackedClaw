"use client";

import { useEffect, useState } from "react";
import { User, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    const initUser = async () => {
      try {
        const supabase = createClient();

        // Get initial user
        const { data, error } = await supabase.auth.getUser();
        
        if (mounted) {
          if (error) {
            // User not logged in or auth failed - that's okay
            setUser(null);
          } else {
            setUser(data?.user ?? null);
          }
          setLoading(false);
        }

        // Listen for auth changes
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
          if (mounted) {
            setUser(session?.user ?? null);
            setLoading(false);
          }
        });

        return () => subscription.unsubscribe();
      } catch (error) {
        // Supabase client failed (e.g., placeholder credentials)
        console.warn('[useUser] Auth check failed:', error);
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };
    
    initUser();
    
    return () => {
      mounted = false;
    };
  }, []);

  return { user, loading };
}
