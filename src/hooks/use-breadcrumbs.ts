"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { BreadcrumbItem } from "@/components/ui/breadcrumbs";

// Static page labels for known routes
const pageLabels: Record<string, string> = {
  "": "Dashboard",
  settings: "Settings",
  workflows: "Workflows",
  chat: "Chat",
  memory: "Memory",
  integrations: "Integrations",
  activity: "Activity",
  usage: "Usage",
  "tunnel-setup": "Tunnel Setup",
  export: "Export",
  new: "New",
  runs: "Run History",
  invite: "Team Invitation",
  add: "Add",
};

export interface UseBreadcrumbsOptions {
  /**
   * Override labels for dynamic segments (e.g., workflow names)
   * Key is the segment value, value is the display label
   */
  overrides?: Record<string, string>;
}

export function useBreadcrumbs(options: UseBreadcrumbsOptions = {}): BreadcrumbItem[] {
  const pathname = usePathname();
  const { overrides = {} } = options;

  const breadcrumbs = useMemo(() => {
    // Split pathname into segments, filtering out empty strings
    const segments = pathname.split("/").filter(Boolean);

    // Always start with Dashboard
    const items: BreadcrumbItem[] = [
      { label: "Dashboard", href: "/" },
    ];

    // If we're on the dashboard, don't show it as a breadcrumb
    if (segments.length === 0) {
      return [];
    }

    // Build breadcrumb items from path segments
    let currentPath = "";
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath += `/${segment}`;
      const isLast = i === segments.length - 1;

      // Check for override first, then static label, then format the segment
      let label = overrides[segment] || pageLabels[segment];
      
      if (!label) {
        // Check if this looks like a UUID or ID (for dynamic routes)
        const isId = /^[a-f0-9-]{8,}$/i.test(segment);
        if (isId) {
          // Use override if provided, otherwise use a generic label
          label = overrides[segment] || "Details";
        } else {
          // Convert segment to title case
          label = segment
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
        }
      }

      items.push({
        label,
        // Last item doesn't get a link
        href: isLast ? undefined : currentPath,
      });
    }

    return items;
  }, [pathname, overrides]);

  return breadcrumbs;
}

/**
 * Generate breadcrumbs for a specific path (useful for server components)
 */
export function generateBreadcrumbs(
  pathname: string,
  overrides: Record<string, string> = {}
): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [];
  }

  const items: BreadcrumbItem[] = [
    { label: "Dashboard", href: "/" },
  ];

  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;
    const isLast = i === segments.length - 1;

    let label = overrides[segment] || pageLabels[segment];

    if (!label) {
      const isId = /^[a-f0-9-]{8,}$/i.test(segment);
      if (isId) {
        label = overrides[segment] || "Details";
      } else {
        label = segment
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      }
    }

    items.push({
      label,
      href: isLast ? undefined : currentPath,
    });
  }

  return items;
}
