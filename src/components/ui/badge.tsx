import { cn } from "@/lib/utils";

interface BadgeProps {
  status: "active" | "inactive" | "pending" | "error";
  children: React.ReactNode;
  className?: string;
}

const statusColors: Record<BadgeProps["status"], string> = {
  active: "bg-mint",
  inactive: "bg-white/20",
  pending: "bg-gold",
  error: "bg-coral",
};

export function Badge({ status, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border border-white/[0.15] rounded-none px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-white/70",
        className
      )}
    >
      <span className={cn("w-2 h-2 block rounded-none", statusColors[status])} />
      {children}
    </span>
  );
}
