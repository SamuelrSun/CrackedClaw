import { AlertCircle } from "lucide-react";

interface FormErrorSummaryProps {
  errors: string[];
  onScrollToFirst?: () => void;
}

export function FormErrorSummary({ errors, onScrollToFirst }: FormErrorSummaryProps) {
  if (errors.length === 0) return null;

  return (
    <div 
      className="p-3 bg-coral/10 border border-coral/30 rounded-none"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-coral flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-mono text-[11px] text-coral uppercase tracking-wide font-bold mb-1">
            Please fix the following errors:
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {errors.map((error, index) => (
              <li 
                key={index} 
                className="font-mono text-[11px] text-coral cursor-pointer hover:underline"
                onClick={onScrollToFirst}
              >
                {error}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
