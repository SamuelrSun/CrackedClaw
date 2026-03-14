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
          <label className="font-mono text-[10px] uppercase tracking-wide text-white/50">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            className={cn(
              "w-full bg-white/[0.07] backdrop-blur-sm border rounded-none px-3 py-2",
              "font-body text-sm text-white/90 placeholder:text-white/25",
              "outline-none transition-colors",
              showError 
                ? "border-coral focus:border-coral" 
                : "border-white/[0.15] focus:border-white/[0.4]",
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
