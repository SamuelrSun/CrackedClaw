"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { UserMenu } from "@/components/auth/user-menu";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { useGateway } from "@/hooks/use-gateway";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "/chat", label: "Chat" },
  { href: "/brain", label: "Brain" },
  { href: "/agents", label: "Agents" },
  { href: "/integrations", label: "Integrations" },
  { href: "/skills", label: "Skills" },
  { href: "/docs", label: "Docs" },
  { href: "/settings", label: "Settings" },
];

export function GlassNavbar({ sidebarToggle }: { sidebarToggle?: ReactNode } = {}) {
  const pathname = usePathname();
  const { user } = useUser();
  const { status: gatewayStatus } = useGateway();
  const isConnected = gatewayStatus === "connected";
  const isReconnecting =
    gatewayStatus === "reconnecting" ||
    gatewayStatus === "connecting" ||
    gatewayStatus === "checking";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <>
      <nav className="shrink-0 h-[48px] md:h-[56px] bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 overflow-visible flex items-center px-3 md:px-6 relative">
        {/* Sidebar toggle (provided by parent page) or default mobile hamburger */}
        {sidebarToggle || (
          <button
            onClick={() => setMobileNavOpen((v) => !v)}
            className="md:hidden w-8 h-8 flex items-center justify-center text-white/50 hover:text-white/80 mr-2"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}
        <div className="mr-4 md:mr-6">
          <WorkspaceSwitcher />
        </div>
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm px-3 py-1.5 transition-colors",
                  isActive
                    ? "text-white/90 font-semibold"
                    : "font-normal text-white/50 hover:text-white/80"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-2 md:gap-4">
          {user && (
            <>
              <Link
                href="/settings"
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                {isConnected ? (
                  <>
                    <div className="w-2 h-2 bg-emerald-700 rounded-none block flex-shrink-0" />
                    <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wide text-emerald-600">
                      Online
                    </span>
                  </>
                ) : isReconnecting ? (
                  <>
                    <div className="w-2 h-2 bg-amber-500 rounded-none block animate-pulse flex-shrink-0" />
                    <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wide text-amber-400">
                      Connecting
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-red-600 rounded-none block flex-shrink-0" />
                    <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wide text-red-500">
                      Offline
                    </span>
                  </>
                )}
              </Link>
              <div className="h-4 w-px bg-white/[0.1]" />
            </>
          )}
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Link
              href="/welcome"
              className="font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 text-white/60 hover:bg-white/[0.1] hover:text-white/90 border border-white/[0.15] transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile dropdown (only when no custom sidebarToggle) */}
        {!sidebarToggle && mobileNavOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 md:hidden bg-black/[0.15] backdrop-blur-[20px] border border-white/10 rounded-[3px] py-2 z-50">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={cn(
                    "block text-sm px-4 py-3 min-h-[44px] flex items-center transition-colors",
                    isActive
                      ? "text-white/90 font-semibold bg-white/[0.06]"
                      : "text-white/50 hover:text-white/80"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>
    </>
  );
}
