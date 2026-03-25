"use client";

import Link from "next/link";
import { useState } from "react";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { UserMenu } from "@/components/auth/user-menu";
import { useSearchContext } from "@/contexts/search-context";
import { useGateway } from "@/hooks/use-gateway";
import { Search, Command, Menu, X } from "lucide-react";

const navLinks = [
  { href: "/chat", label: "Chat" },
  { href: "/brain", label: "Brain" },
  { href: "/agents", label: "Agents" },
  { href: "/integrations", label: "Integrations" },
  { href: "/docs", label: "Docs" },
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/[0.05] backdrop-blur-xl border-b border-white/[0.1]">
        <div className="flex items-center h-16 px-3 md:px-6">

          {/* Mobile: hamburger button */}
          <button
            className="md:hidden w-10 h-10 flex items-center justify-center text-white/60 hover:text-white mr-1 flex-shrink-0"
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="hidden md:block mr-8">
            <WorkspaceSwitcher />
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-sm font-medium px-3 py-1.5 rounded transition-colors",
                    isActive
                      ? "text-white bg-white/[0.1]"
                      : "text-white/50 hover:text-white/80"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:gap-4">
            {/* Search Button — full on sm+, icon-only on xs */}
            <button
              onClick={openSearch}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 border border-white/[0.1] hover:border-white/[0.25] hover:bg-white/[0.08] transition-colors group"
            >
              <Search className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70" />
              <span className="font-mono text-[10px] text-white/40 group-hover:text-white/70 hidden sm:inline">
                Search...
              </span>
              <div className="hidden sm:flex items-center gap-0.5 ml-2">
                <kbd className="font-mono text-[9px] px-1 py-0.5 bg-white/[0.06] border border-white/[0.1] text-white/30">
                  <Command className="w-2.5 h-2.5 inline" />
                </kbd>
                <kbd className="font-mono text-[9px] px-1 py-0.5 bg-white/[0.06] border border-white/[0.1] text-white/30">
                  K
                </kbd>
              </div>
            </button>
            {/* Search icon only on mobile */}
            <button
              onClick={openSearch}
              className="sm:hidden w-9 h-9 flex items-center justify-center text-white/50 hover:text-white"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>

            <div className="hidden sm:block h-4 w-px bg-white/[0.1]" />

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
                      <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wide text-mint/80">
                        {statusInfo?.agentName || 'Connected'}
                      </span>
                    </>
                  ) : isGatewayReconnecting ? (
                    <>
                      <span className="w-2 h-2 bg-gold rounded-none block animate-pulse" />
                      <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wide text-gold/80">
                        Reconnecting
                      </span>
                    </>
                  ) : isGatewayError ? (
                    <>
                      <span className="w-2 h-2 bg-coral rounded-none block" />
                      <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wide text-coral/80">
                        Error
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 bg-white/20 rounded-none block" />
                      <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wide text-white/30">
                        Offline
                      </span>
                    </>
                  )}
                </Link>

                <div className="hidden sm:block h-4 w-px bg-white/[0.1]" />
              </>
            )}

            {loading ? (
              <div className="w-6 h-6 bg-white/[0.08] animate-pulse" />
            ) : user ? (
              <UserMenu user={user} />
            ) : (
              <Link
                href="/welcome"
                className="font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 text-white/70 hover:bg-white/[0.1] hover:text-white border border-white/[0.15] transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="fixed top-16 left-0 right-0 z-40 md:hidden bg-black/90 backdrop-blur-xl border-b border-white/[0.1]">
          <div className="px-4 py-4 space-y-1">
            <div className="mb-3 pb-3 border-b border-white/[0.08]">
              <WorkspaceSwitcher />
            </div>
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "block text-sm font-medium px-3 py-3 min-h-[44px] flex items-center transition-colors",
                    isActive
                      ? "text-white bg-white/[0.1]"
                      : "text-white/50 hover:text-white/80"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
