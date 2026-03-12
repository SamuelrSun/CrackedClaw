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
    <div className="flex items-center gap-2 px-2 py-1">
      <div className="w-7 h-7 bg-forest rounded-none flex items-center justify-center flex-shrink-0">
        <span className="text-white font-header text-xs font-bold">D</span>
      </div>
      <span className="font-header text-sm font-bold tracking-tight text-forest leading-tight">
        Dopl
      </span>
    </div>
  );
}
