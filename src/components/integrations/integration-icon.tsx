import { getIntegrationLogoUrl, getIntegrationLogoFallbackUrl } from "@/lib/integrations/logos";

interface IntegrationIconProps {
  provider: string;
  size?: number;
  className?: string;
}

export function IntegrationIcon({ provider, size = 24, className }: IntegrationIconProps) {
  return (
    <img
      src={getIntegrationLogoUrl(provider, size * 2)}
      alt={provider}
      width={size}
      height={size}
      className={`rounded-sm flex-shrink-0 object-contain ${className || ""}`}
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        // Try Google favicon fallback before hiding
        if (!img.dataset.fallback) {
          img.dataset.fallback = "true";
          img.src = getIntegrationLogoFallbackUrl(provider);
        } else {
          img.style.display = "none";
        }
      }}
    />
  );
}
