"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface SidebarItem {
  href: string;
  label: string;
  index: string;
}

interface SidebarProps {
  items: SidebarItem[];
  title?: string;
}

export function Sidebar({ items, title }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r border-white/[0.1] min-h-[calc(100vh-56px)] bg-white/[0.03] backdrop-blur-sm">
      {title && (
        <div className="px-4 py-3 border-b border-white/[0.1]">
          <span className="font-mono text-[10px] uppercase tracking-wide text-white/40">
            {title}
          </span>
        </div>
      )}
      <nav className="py-2">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 font-mono text-[11px] uppercase tracking-wide transition-colors",
                isActive
                  ? "text-white/90 bg-white/[0.08] border-r-2 border-white/40"
                  : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
              )}
            >
              <span className="text-white/20">{item.index}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
