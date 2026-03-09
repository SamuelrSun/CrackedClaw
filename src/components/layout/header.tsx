"use client";

import Link from "next/link";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { UserMenu } from "@/components/auth/user-menu";
import { useSearchContext } from "@/contexts/search-context";
import { useGateway } from "@/hooks/use-gateway";
import { Search, Command } from "lucide-react";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/commands", label: "Commands" },
  { href: "/chat", label: "Chat" },
  { href: "/memory", label: "Memory" },
  { href: "/usage", label: "Usage" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
];

export function Header() {
  const pathname = usePathname();
  const { user, loading } = useUser();
  const { openSearch } = useSearchContext();
  // Bug 4 fix: use real-time gateway status from the hook
  const { status: gatewayStatus, loading: gatewayLoading, statusInfo } = useGateway();
  const gatewayLoaded = !gatewayLoading;
  const isGatewayConnected = gatewayStatus === 'connected';
  const isGatewayError = gatewayStatus === 'error';
  const isGatewayReconnecting = gatewayStatus === 'reconnecting' || gatewayStatus === 'connecting' || gatewayStatus === 'checking';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-paper border-b border-[rgba(58,58,56,0.2)]">
      <div className="flex items-center h-14 px-6">
        <div className="mr-8">
          <WorkspaceSwitcher />
        </div>

        <nav className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 transition-colors",
                  isActive
                    ? "text-forest bg-forest/5"
                    : "text-grid/50 hover:text-forest"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-4">
          {/* Search Button */}
          <button
            onClick={openSearch}
            className="flex items-center gap-2 px-3 py-1.5 border border-[rgba(58,58,56,0.15)] hover:border-[rgba(58,58,56,0.3)] hover:bg-forest/5 transition-colors group"
          >
            <Search className="w-3.5 h-3.5 text-grid/50 group-hover:text-forest" />
            <span className="font-mono text-[10px] text-grid/50 group-hover:text-forest hidden sm:inline">
              Search...
            </span>
            <div className="hidden sm:flex items-center gap-0.5 ml-2">
              <kbd className="font-mono text-[9px] px-1 py-0.5 bg-forest/5 border border-[rgba(58,58,56,0.1)] text-grid/40">
                <Command className="w-2.5 h-2.5 inline" />
              </kbd>
              <kbd className="font-mono text-[9px] px-1 py-0.5 bg-forest/5 border border-[rgba(58,58,56,0.1)] text-grid/40">
                K
              </kbd>
            </div>
          </button>

          <div className="h-4 w-px bg-[rgba(58,58,56,0.15)]" />

          {/* Bug 4 fix: Gateway status indicator — reflects actual connection state */}
          {gatewayLoaded && user && (
            <>
              <Link
                href="/settings"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                title={
                  isGatewayConnected
                    ? `Connected to ${statusInfo?.agentName || 'gateway'}`
                    : isGatewayReconnecting
                    ? 'Reconnecting to gateway...'
                    : isGatewayError
                    ? 'Gateway error — click to fix'
                    : 'Gateway disconnected — click to connect'
                }
              >
                {isGatewayConnected ? (
                  <>
                    <span className="w-2 h-2 bg-mint rounded-none block animate-pulse" />
                    <span className="font-mono text-[10px] uppercase tracking-wide text-forest">
                      {statusInfo?.agentName || 'Connected'}
                    </span>
                  </>
                ) : isGatewayReconnecting ? (
                  <>
                    <span className="w-2 h-2 bg-[#F4D35E] rounded-none block animate-pulse" />
                    <span className="font-mono text-[10px] uppercase tracking-wide text-[#B8860B]">
                      Reconnecting
                    </span>
                  </>
                ) : isGatewayError ? (
                  <>
                    <span className="w-2 h-2 bg-red-400 rounded-none block" />
                    <span className="font-mono text-[10px] uppercase tracking-wide text-red-500">
                      Error
                    </span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 bg-grid/30 rounded-none block" />
                    <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
                      Offline
                    </span>
                  </>
                )}
              </Link>

              <div className="h-4 w-px bg-[rgba(58,58,56,0.15)]" />
            </>
          )}

          {loading ? (
            <div className="w-6 h-6 bg-forest/5 animate-pulse" />
          ) : user ? (
            <UserMenu user={user} />
          ) : (
            <Link
              href="/login"
              className="font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 text-forest hover:bg-forest hover:text-white border border-[rgba(58,58,56,0.2)] transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
