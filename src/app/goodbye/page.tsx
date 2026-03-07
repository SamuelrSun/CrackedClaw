import Link from "next/link";

export default function GoodbyePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sand p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="w-16 h-16 bg-forest/10 mx-auto mb-4 flex items-center justify-center">
            <span className="text-3xl">👋</span>
          </div>
          <h1 className="font-header text-3xl font-bold tracking-tight text-forest mb-2">
            Goodbye!
          </h1>
          <p className="font-mono text-[11px] text-grid/60">
            Your account has been successfully deleted.
          </p>
        </div>

        <div className="space-y-4">
          <p className="font-mono text-[11px] text-grid/70">
            All your data has been permanently removed from our systems.
            We&apos;re sorry to see you go!
          </p>

          <div className="p-4 bg-forest/5 border border-forest/10">
            <p className="font-mono text-[11px] text-grid/60">
              If you ever want to come back, you can always create a new account.
            </p>
          </div>

          <Link 
            href="/"
            className="inline-block font-mono text-[11px] text-forest hover:text-mint transition-colors underline underline-offset-2"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
