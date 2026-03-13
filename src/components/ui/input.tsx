import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";
import { AlertCircle } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  touched?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, touched, ...props }, ref) => {
    const showError = error && touched;
    
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className={cn("font-mono text-[10px] uppercase tracking-wide text-grid/60", className?.includes("login-glass") && "text-white/60")}>
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            className={cn(
              "w-full bg-white border rounded-none px-3 py-2",
              "font-body text-sm text-forest placeholder:text-grid/30",
              "outline-none transition-colors",
              showError 
                ? "border-coral focus:border-coral" 
                : "border-[rgba(58,58,56,0.2)] focus:border-forest",
              showError && "pr-10",
              className
            )}
            {...props}
          />
          {showError && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-coral">
              <AlertCircle className="w-4 h-4" />
            </div>
          )}
        </div>
        {showError && (
          <span className="font-mono text-[11px] text-coral">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export { Input };
