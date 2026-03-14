import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default function ConnectPage() {
  return (
    <div className="min-h-screen bg-white/[0.03] flex items-center justify-center p-6">
      <div className="max-w-xl w-full space-y-6">
        <div className="text-center mb-8">
          <h1 className="font-header text-4xl font-bold tracking-tight text-forest">
            Dopl Connect
          </h1>
          <p className="font-mono text-[11px] uppercase tracking-wide text-grid/50 mt-2">
            Link your Mac to your cloud AI instance
          </p>
        </div>

        <Card label="Get Started" accentColor="#9EFFBF" bordered>
          <ol className="mt-4 space-y-6">
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-6 h-6 bg-forest text-white font-mono text-xs flex items-center justify-center">
                1
              </span>
              <div className="flex-1">
                <p className="font-header text-sm font-bold text-forest">
                  Download Dopl Connect for macOS
                </p>
                <div className="mt-2">
                  <Button variant="solid" size="sm" disabled>
                    Download for macOS — Coming Soon
                  </Button>
                </div>
              </div>
            </li>

            <li className="flex gap-4">
              <span className="flex-shrink-0 w-6 h-6 bg-forest text-white font-mono text-xs flex items-center justify-center">
                2
              </span>
              <div className="flex-1">
                <p className="font-header text-sm font-bold text-forest">
                  Open the app
                </p>
                <p className="font-mono text-[11px] text-grid/60 mt-1">
                  Launch Dopl Connect after installing
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <span className="flex-shrink-0 w-6 h-6 bg-forest text-white font-mono text-xs flex items-center justify-center">
                3
              </span>
              <div className="flex-1">
                <p className="font-header text-sm font-bold text-forest">
                  Copy your Connection Token
                </p>
                <p className="font-mono text-[11px] text-grid/60 mt-1">
                  Go to{" "}
                  <Link href="/settings/nodes" className="text-forest underline hover:text-mint transition-colors">
                    Settings → Nodes
                  </Link>{" "}
                  in Dopl and copy your Connection Token
                </p>
              </div>
            </li>

            <li className="flex gap-4">
              <span className="flex-shrink-0 w-6 h-6 bg-forest text-white font-mono text-xs flex items-center justify-center">
                4
              </span>
              <div className="flex-1">
                <p className="font-header text-sm font-bold text-forest">
                  Paste and Connect
                </p>
                <p className="font-mono text-[11px] text-grid/60 mt-1">
                  Paste the token into Dopl Connect and click Connect
                </p>
              </div>
            </li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
