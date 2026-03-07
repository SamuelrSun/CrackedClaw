"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard", num: "01" },
  { href: "/commands", label: "Commands", num: "02" },
  { href: "/chat", label: "Chat", num: "03" },
  { href: "/memory", label: "Memory", num: "04" },
  { href: "/integrations", label: "Integrations", num: "05" },
  { href: "/settings", label: "Settings", num: "06" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-paper border-b border-[rgba(58,58,56,0.2)]">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-forest rounded-none flex items-center justify-center">
              <span className="text-white text-xs font-bold font-mono">{"/>"}</span>
            </div>
            <span className="font-header text-sm font-bold tracking-tight text-forest">
              OpenClaw
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "font-mono text-[10px] uppercase tracking-wide px-3 py-1.5 transition-colors",
                  pathname === link.href
                    ? "text-forest bg-forest/5"
                    : "text-grid/50 hover:text-forest"
                )}
              >
                {link.num}. {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-mint rounded-none block" />
            <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
              Online
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
