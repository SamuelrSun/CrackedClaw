"use client";

import { cn } from "@/lib/utils";
import {
  Sun,
  Mail,
  Search,
  FileText,
  Calendar,
  BarChart3,
  Zap,
  Bell,
  Clock,
  Database,
  Globe,
  MessageSquare,
  Settings,
  Star,
  Heart,
  Bookmark,
  Cloud,
  Folder,
  type LucideIcon,
} from "lucide-react";

export const WORKFLOW_ICONS: { name: string; icon: LucideIcon }[] = [
  { name: "Zap", icon: Zap },
  { name: "Sun", icon: Sun },
  { name: "Mail", icon: Mail },
  { name: "Search", icon: Search },
  { name: "FileText", icon: FileText },
  { name: "Calendar", icon: Calendar },
  { name: "BarChart3", icon: BarChart3 },
  { name: "Bell", icon: Bell },
  { name: "Clock", icon: Clock },
  { name: "Database", icon: Database },
  { name: "Globe", icon: Globe },
  { name: "MessageSquare", icon: MessageSquare },
  { name: "Settings", icon: Settings },
  { name: "Star", icon: Star },
  { name: "Heart", icon: Heart },
  { name: "Bookmark", icon: Bookmark },
  { name: "Cloud", icon: Cloud },
  { name: "Folder", icon: Folder },
];

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
        Icon
      </label>
      <div className="grid grid-cols-6 gap-2 p-3 border border-white/[0.1] bg-white">
        {WORKFLOW_ICONS.map(({ name, icon: Icon }) => (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            className={cn(
              "w-10 h-10 flex items-center justify-center transition-all",
              "border border-white/[0.1] hover:border-forest hover:bg-forest/5",
              value === name && "border-forest bg-forest text-white hover:bg-forest hover:text-white"
            )}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function getIconComponent(name: string): LucideIcon {
  const found = WORKFLOW_ICONS.find((i) => i.name === name);
  return found?.icon ?? Zap;
}
