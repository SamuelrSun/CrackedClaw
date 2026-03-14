"use client";

import { useState, useRef, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { LogoutButton } from "./logout-button";

interface UserMenuProps {
  user: User;
}

export function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const avatarUrl = user.user_metadata?.avatar_url;
  const email = user.email;
  const name = user.user_metadata?.full_name || email?.split("@")[0];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/[0.08] transition-colors"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="w-6 h-6 rounded-none border border-white/[0.1]"
          />
        ) : (
          <div className="w-6 h-6 bg-white/[0.1] border border-white/[0.15] flex items-center justify-center">
            <span className="font-mono text-[10px] text-white/70 uppercase">
              {name?.charAt(0)}
            </span>
          </div>
        )}
        <svg
          className={`w-3 h-3 text-grid/40 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white/[0.08] backdrop-blur-xl border border-white/[0.15] shadow-2xl shadow-black/50 z-50">
          <div className="px-3 py-3 border-b border-white/[0.1]">
            <p className="font-mono text-[11px] text-white/80 truncate">{name}</p>
            <p className="font-mono text-[10px] text-white/40 truncate mt-0.5">{email}</p>
          </div>
          <div className="py-1">
            <LogoutButton />
          </div>
        </div>
      )}
    </div>
  );
}
