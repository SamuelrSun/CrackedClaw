import { Suspense } from "react";
import { WelcomeContent } from "./welcome-content";

export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ backgroundColor: "#0a0a0f" }}
        >
          <div
            className="fixed inset-0 z-0"
            style={{
              backgroundImage: "url('/img/landing_background.jpg')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div
            className="fixed inset-0 z-0"
            style={{ background: "rgba(0,0,0,0.25)" }}
          />
          <p
            className="relative z-10 font-mono text-[11px] text-white/60 uppercase tracking-wide"
            style={{ fontFamily: "monospace" }}
          >
            Loading...
          </p>
        </div>
      }
    >
      <WelcomeContent />
    </Suspense>
  );
}
