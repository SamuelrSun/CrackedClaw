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
    <aside className="w-56 border-r border-[rgba(58,58,56,0.2)] min-h-[calc(100vh-56px)] bg-paper">
      {title && (
        <div className="px-4 py-3 border-b border-[rgba(58,58,56,0.2)]">
          <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
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
                  ? "text-forest bg-forest/5 border-r-2 border-forest"
                  : "text-grid/50 hover:text-forest"
              )}
            >
              <span className="text-grid/30">{item.index}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
