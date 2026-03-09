import { getIntegrationLogoUrl } from "@/lib/integrations/logos";

interface IntegrationIconProps {
  provider: string;
  size?: number;
  className?: string;
}

export function IntegrationIcon({ provider, size = 24, className }: IntegrationIconProps) {
  return (
    <img
      src={getIntegrationLogoUrl(provider, size)}
      alt={provider}
      width={size}
      height={size}
      className={`rounded-sm flex-shrink-0 ${className || ""}`}
      onError={(e) => {
        // Fallback: hide if favicon fails
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
