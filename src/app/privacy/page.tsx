import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Dopl",
  description: "Dopl Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper text-forest">
      {/* Nav */}
      <nav className="border-b border-[rgba(58,58,56,0.15)] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-mono text-sm font-semibold tracking-tight hover:opacity-80 transition-opacity">
            Dopl
          </Link>
          <Link href="/login" className="font-mono text-xs text-grid/60 hover:text-forest transition-colors">
            Sign in →
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-mono text-2xl font-bold mb-2 tracking-tight">Privacy Policy</h1>
        <p className="font-mono text-xs text-grid/50 mb-12">Last updated: March 2025</p>

        <div className="space-y-10 font-mono text-sm leading-relaxed text-forest/90">
          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">1. Introduction</h2>
            <p>
              Dopl Inc. (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI agent platform (&ldquo;Service&rdquo;).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">2. Information We Collect</h2>
            <p className="mb-3">We collect the following categories of information:</p>
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-forest mb-1">Account Information</p>
                <p className="text-forest/80">Email address, display name, and authentication credentials when you create an account.</p>
              </div>
              <div>
                <p className="font-semibold text-forest mb-1">Usage Data</p>
                <p className="text-forest/80">Conversations, memory entries, workflows, and activity logs generated through your use of the Service.</p>
              </div>
              <div>
                <p className="font-semibold text-forest mb-1">Technical Data</p>
                <p className="text-forest/80">IP addresses, browser type, device identifiers, and access timestamps for security and diagnostics.</p>
              </div>
              <div>
                <p className="font-semibold text-forest mb-1">Payment Information</p>
                <p className="text-forest/80">Billing details are processed by Stripe. We do not store full payment card numbers.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">3. How We Use Your Information</h2>
            <p className="mb-2">We use your information to:</p>
            <ul className="list-disc pl-5 space-y-1 text-forest/80">
              <li>Provide, operate, and improve the Service</li>
              <li>Authenticate your account and ensure security</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send transactional emails (account activity, billing)</li>
              <li>Respond to support requests</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-3">We do not sell your personal information or use it to train AI models without your explicit consent.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">4. Data Storage and Security</h2>
            <p>
              Your data is stored in Supabase (PostgreSQL) hosted on infrastructure in the United States. We implement industry-standard security measures including encryption in transit (TLS) and at rest. Access to your data is restricted to authorized personnel and systems.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">5. Third-Party Services</h2>
            <p className="mb-2">We use the following third-party services, each with their own privacy policies:</p>
            <ul className="list-disc pl-5 space-y-1 text-forest/80">
              <li><strong>Supabase</strong> — database and authentication</li>
              <li><strong>Stripe</strong> — payment processing</li>
              <li><strong>Anthropic</strong> — AI model inference (when using default API key)</li>
              <li><strong>Vercel</strong> — hosting and deployment</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">6. Data Sharing</h2>
            <p>
              We do not share your personal information with third parties except: (a) with service providers necessary to operate the Service, (b) when required by law, (c) to protect the rights and safety of our users and company, or (d) with your explicit consent.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">7. Your Rights</h2>
            <p className="mb-2">You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 text-forest/80">
              <li>Access and download your data (via the Export feature in Settings)</li>
              <li>Correct inaccurate information in your account</li>
              <li>Delete your account and associated data</li>
              <li>Opt out of non-transactional communications</li>
              <li>Lodge a complaint with a supervisory authority (EU users)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">8. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management. We do not use tracking or advertising cookies. You may disable cookies in your browser, but this may affect functionality.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">9. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. After account deletion, your data is retained for 30 days to allow for export, then permanently deleted. Anonymized aggregate statistics may be retained indefinitely.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">10. Children&rsquo;s Privacy</h2>
            <p>
              The Service is not directed to individuals under 18. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes via email or in-app notification. Continued use of the Service constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">12. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or your data, contact us at{" "}
              <a href="mailto:privacy@dopl.com" className="underline hover:text-mint transition-colors">
                privacy@dopl.com
              </a>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-[rgba(58,58,56,0.1)] px-6 py-8 mt-16">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <p className="font-mono text-[10px] text-grid/40">© 2025 Dopl Inc.</p>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="font-mono text-[10px] text-grid/40 hover:text-forest transition-colors">Terms</Link>
            <Link href="/privacy" className="font-mono text-[10px] text-grid/40 hover:text-forest transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
