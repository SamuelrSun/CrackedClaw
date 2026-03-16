export default function IntegrationsLoading() {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col p-[7px] gap-[7px]"
      style={{
        backgroundImage: "url('/img/landing_background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Navbar skeleton */}
      <div className="shrink-0 h-[56px] bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 flex items-center px-6 gap-4">
        <div className="w-32 h-5 bg-white/[0.08] rounded-[2px] animate-pulse" />
        <div className="flex items-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-20 h-4 bg-white/[0.06] rounded-[2px] animate-pulse" />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="w-16 h-4 bg-white/[0.06] rounded-[2px] animate-pulse" />
          <div className="w-8 h-8 bg-white/[0.08] rounded-full animate-pulse" />
        </div>
      </div>

      {/* Quick Connect + Maton panel skeleton */}
      <div className="bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 p-5">
        <div className="w-28 h-3 bg-white/[0.08] rounded-[2px] animate-pulse mb-3" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-28 h-8 bg-white/[0.06] rounded-[2px] animate-pulse" />
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-white/[0.08] flex items-center justify-between">
          <div>
            <div className="w-40 h-4 bg-white/[0.08] rounded-[2px] animate-pulse mb-2" />
            <div className="w-64 h-3 bg-white/[0.05] rounded-[2px] animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-64 h-8 bg-white/[0.06] rounded-[4px] animate-pulse" />
            <div className="w-16 h-8 bg-white/[0.06] rounded-[4px] animate-pulse" />
          </div>
        </div>
      </div>

      {/* Search bar skeleton */}
      <div className="bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 p-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white/[0.06] rounded-[2px] animate-pulse" />
          <div className="flex-1 h-4 bg-white/[0.05] rounded-[2px] animate-pulse" />
          <div className="w-24 h-8 bg-white/[0.08] rounded-[2px] animate-pulse" />
        </div>
      </div>

      {/* Integration cards grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[7px]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 p-5"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 bg-white/[0.08] rounded-[2px] animate-pulse flex-shrink-0" />
              <div className="flex-1">
                <div className="w-28 h-4 bg-white/[0.08] rounded-[2px] animate-pulse mb-2" />
                <div className="w-20 h-3 bg-white/[0.05] rounded-[2px] animate-pulse" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="w-full h-3 bg-white/[0.05] rounded-[2px] animate-pulse" />
              <div className="w-3/4 h-3 bg-white/[0.04] rounded-[2px] animate-pulse" />
            </div>
            <div className="mt-4 w-full h-8 bg-white/[0.06] rounded-[2px] animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
