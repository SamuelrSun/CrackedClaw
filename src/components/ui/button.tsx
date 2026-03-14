import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "ghost" | "solid";
  size?: "sm" | "md";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "ghost", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-mono text-[10px] uppercase tracking-wide transition-colors",
          "border rounded-none",
          size === "sm" && "px-3 py-1.5",
          size === "md" && "px-4 py-2",
          variant === "ghost" && "bg-white/[0.06] border-white/[0.15] text-white/70 hover:bg-white/[0.12] hover:text-white hover:border-white/[0.3]",
          variant === "solid" && "bg-white/[0.15] border-white/[0.3] text-white hover:bg-white/[0.25]",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
