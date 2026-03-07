import { cn } from "@/lib/utils";
import { Button } from "./button";
import Link from "next/link";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action,
  className 
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-16 px-4",
      className
    )}>
      {icon && (
        <div className="text-forest/20 mb-6">
          <div className="w-12 h-12 flex items-center justify-center">
            {icon}
          </div>
        </div>
      )}
      
      <h3 className="font-header text-lg font-bold text-forest text-center">
        {title}
      </h3>
      
      {description && (
        <p className="mt-2 text-sm text-grid/60 text-center max-w-xs">
          {description}
        </p>
      )}
      
      {action && (
        <div className="mt-6">
          {action.href ? (
            <Link href={action.href}>
              <Button variant="solid">
                {action.label}
              </Button>
            </Link>
          ) : (
            <Button variant="solid" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
