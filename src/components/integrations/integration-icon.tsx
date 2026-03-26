import { getIntegrationLogoUrl, getIntegrationLogoFallbackUrl } from "@/lib/integrations/logos";

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
      className={`rounded-sm flex-shrink-0 object-contain ${className || ""}`}
      style={{
        // Crisp rendering for SVGs and raster images
        imageRendering: 'crisp-edges',
        WebkitFontSmoothing: 'antialiased',
      }}
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
