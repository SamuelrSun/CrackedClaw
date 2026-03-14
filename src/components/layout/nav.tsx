"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/chat", label: "Chat", num: "01" },
  { href: "/agents", label: "Agents", num: "02" },
  { href: "/integrations", label: "Integrations", num: "03" },
  { href: "/settings", label: "Settings", num: "04" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/[0.05] backdrop-blur-xl border-b border-white/[0.1]">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/[0.12] backdrop-blur-sm border border-white/[0.2] rounded-none flex items-center justify-center">
              <span className="text-white text-xs font-bold font-mono">{"/>"}</span>
            </div>
            <span className="font-header text-sm font-bold tracking-tight text-white">
              Dopl
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
                    ? "text-white bg-white/[0.1]"
                    : "text-white/50 hover:text-white"
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
            <span className="font-mono text-[10px] uppercase tracking-wide text-white/50">
              Online
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
