"use client";

/**
 * workspace-switcher.tsx — legacy file, kept as a stub.
 * Multi-workspace support has been removed. Users have a single profile-based instance.
 * The WorkspaceSwitcher is replaced by a simple app logo/name display in the header.
 */

// Kept for any lingering imports during the transition
export function getActiveWorkspaceId(): string | null {
  return null;
}

export function setActiveWorkspaceId(_id: string): void {
  // no-op — workspace switching removed
}

export function WorkspaceSwitcher() {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/android-chrome-192x192.png"
        alt="Dopl"
        className="w-7 h-7 rounded-[4px] flex-shrink-0"
      />
      <span className="font-playfair italic text-[18px] text-white leading-tight">
        Dopl
      </span>
    </div>
  );
}
