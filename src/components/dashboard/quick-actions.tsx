"use client";

import Link from "next/link";

interface QuickAction {
  icon: string;
  label: string;
  href: string;
}

const actions: QuickAction[] = [
  { icon: "💬", label: "New Chat", href: "/chat" },
  { icon: "📧", label: "Draft Email", href: "/chat?prefill=Draft+an+email" },
  { icon: "🔍", label: "Research Something", href: "/chat?prefill=Research+" },
  { icon: "⚙️", label: "Add Integration", href: "/integrations" },
  { icon: "📋", label: "Create Workflow", href: "/workflows/new" },
];

export function QuickActions() {
  return (
    <div className="flex flex-col gap-2">
      {actions.map((action) => (
        <Link
          key={action.href + action.label}
          href={action.href}
          className="flex items-center gap-3 px-4 py-2.5 border border-[rgba(58,58,56,0.2)] text-grid hover:bg-forest hover:text-paper hover:border-forest transition-all duration-150 group"
        >
          <span className="text-base">{action.icon}</span>
          <span className="font-mono text-[11px] uppercase tracking-wide">{action.label}</span>
        </Link>
      ))}
    </div>
  );
}
