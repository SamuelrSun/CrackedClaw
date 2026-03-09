import { cn } from "@/lib/utils";
import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode;
  accentColor?: string;
  bordered?: boolean;
}

export function Card({ className, label, accentColor, bordered = true, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-paper rounded-none p-8 relative",
        bordered && "border border-[rgba(58,58,56,0.2)]",
        className
      )}
      {...props}
    >
      {label && (
        <div className="flex items-center gap-2 mb-4">
          {accentColor && (
            <div className="w-0.5 h-4" style={{ backgroundColor: accentColor }} />
          )}
          {typeof label === "string" ? (
            <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
              {label}
            </span>
          ) : (
            label
          )}
        </div>
      )}
      {children}
    </div>
  );
}
