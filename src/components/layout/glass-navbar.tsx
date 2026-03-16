"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { UserMenu } from "@/components/auth/user-menu";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { useGateway } from "@/hooks/use-gateway";

const navLinks = [
  { href: "/chat", label: "Chat" },
  { href: "/agents", label: "Agents" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
];

export function GlassNavbar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { status: gatewayStatus } = useGateway();
  const isConnected = gatewayStatus === "connected";
  const isReconnecting =
    gatewayStatus === "reconnecting" ||
    gatewayStatus === "connecting" ||
    gatewayStatus === "checking";

  return (
    <nav className="shrink-0 h-[56px] bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 overflow-hidden flex items-center px-6">
      <div className="mr-6">
        <WorkspaceSwitcher />
      </div>
      <div className="flex items-center gap-1">
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
      <div className="ml-auto flex items-center gap-4">
        {user && (
          <>
            <Link
              href="/settings"
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              {isConnected ? (
                <>
                  <div className="w-2 h-2 bg-emerald-700 rounded-none block flex-shrink-0" />
                  <span className="font-mono text-[10px] uppercase tracking-wide text-emerald-600">
                    Online
                  </span>
                </>
              ) : isReconnecting ? (
                <>
                  <div className="w-2 h-2 bg-amber-500 rounded-none block animate-pulse flex-shrink-0" />
                  <span className="font-mono text-[10px] uppercase tracking-wide text-amber-400">
                    Connecting
                  </span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-red-600 rounded-none block flex-shrink-0" />
                  <span className="font-mono text-[10px] uppercase tracking-wide text-red-500">
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
    </nav>
  );
}
