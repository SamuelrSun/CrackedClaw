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
          "border border-[rgba(58,58,56,0.2)] rounded-none",
          size === "sm" && "px-3 py-1.5",
          size === "md" && "px-4 py-2",
          variant === "ghost" && "bg-transparent text-forest hover:bg-forest hover:text-white",
          variant === "solid" && "bg-forest text-white hover:bg-forest/90",
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
