import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Dopl",
  description: "Dopl AI Companion Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "#0a0a0f" }}>
      {/* Background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: "url('/img/landing_background.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="fixed inset-0 z-0" style={{ background: "rgba(0,0,0,0.55)" }} />

      {/* Nav */}
      <nav className="relative z-10 px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/home"
            className="text-lg font-bold text-white/90 hover:text-white transition-colors"
            style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}
          >
            Dopl
          </Link>
          <Link href="/login" className="font-mono text-[10px] text-white/50 hover:text-white uppercase tracking-wide transition-colors">
            Sign in →
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-6 py-12">
        <h1
          className="text-3xl font-bold mb-2 text-white"
          style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}
        >
          Privacy Policy
        </h1>
        <p className="font-mono text-[11px] text-white/40 uppercase tracking-wide mb-12">
          Last updated: March 2026
        </p>

        <div className="space-y-10 font-mono text-[13px] leading-relaxed text-white/80">
          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">1. Introduction</h2>
            <p>
              Dopl AI Companion (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI companion platform (&ldquo;Service&rdquo;). By using the Service, you consent to the practices described in this policy.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">2. Information We Collect</h2>
            <p className="mb-4">We collect the following categories of information:</p>
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-white mb-1">Account Information</p>
                <p className="text-white/70">Name, email address, and authentication credentials (including OAuth tokens from Google or GitHub) when you create an account.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Conversation &amp; Agent Data</p>
                <p className="text-white/70">Messages, conversation history, agent memory entries, workflows, tasks, and activity logs generated through your use of the Service.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Integration Data</p>
                <p className="text-white/70">When you connect third-party accounts (Gmail, Google Calendar, LinkedIn, etc.), we access and process data from those services solely to provide agent functionality. We store OAuth credentials securely and only access the minimum scopes necessary.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Technical Data</p>
                <p className="text-white/70">IP addresses, browser type, device identifiers, operating system, and access timestamps collected for security, diagnostics, and service improvement.</p>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Payment Information</p>
                <p className="text-white/70">Billing details are processed exclusively by Stripe. We do not store full payment card numbers on our servers.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">3. How We Use Your Information</h2>
            <p className="mb-3">We use your information to:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-white/70">
              <li>Provide, operate, and maintain the Service and your AI agent</li>
              <li>Authenticate your account and ensure security</li>
              <li>Process payments and manage subscriptions</li>
              <li>Execute agent actions on your behalf (sending emails, managing calendar, etc.)</li>
              <li>Maintain agent memory and conversation context across sessions</li>
              <li>Send transactional communications (account activity, billing, security alerts)</li>
              <li>Respond to support requests</li>
              <li>Improve and develop new features</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-4 font-semibold text-white">
              We do not sell your personal information. We do not use your conversations or data to train AI models without your explicit opt-in consent.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">4. Data Storage and Security</h2>
            <p>
              Your data is stored in Supabase (PostgreSQL) hosted on secure infrastructure in the United States. Agent instances run on isolated cloud servers with encrypted storage. We implement industry-standard security measures including encryption in transit (TLS 1.2+), encryption at rest, and strict access controls. Access to your data is restricted to authorized systems and personnel on a need-to-know basis.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">5. Third-Party Services</h2>
            <p className="mb-3">The Service relies on the following third-party providers, each governed by their own privacy policies:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-white/70">
              <li><strong className="text-white">Supabase</strong> — database, authentication, and real-time infrastructure</li>
              <li><strong className="text-white">Stripe</strong> — payment processing and subscription management</li>
              <li><strong className="text-white">Anthropic</strong> — AI model inference (Claude)</li>
              <li><strong className="text-white">OpenAI</strong> — AI model inference (when selected by user)</li>
              <li><strong className="text-white">Vercel</strong> — web application hosting and deployment</li>
              <li><strong className="text-white">DigitalOcean</strong> — agent instance hosting</li>
              <li><strong className="text-white">Google</strong> — OAuth authentication and workspace integrations</li>
              <li><strong className="text-white">GitHub</strong> — OAuth authentication</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">6. Data Sharing</h2>
            <p>
              We do not share your personal information with third parties except: (a) with service providers strictly necessary to operate the Service, under contractual data protection obligations; (b) when required by law, subpoena, or valid legal process; (c) to protect the rights, safety, and property of our users, Company, or the public; or (d) with your explicit consent.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">7. Your Rights</h2>
            <p className="mb-3">You have the following rights regarding your data:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-white/70">
              <li><strong className="text-white">Access</strong> — download your data at any time via the Export feature in Settings</li>
              <li><strong className="text-white">Correction</strong> — update inaccurate account information through your profile</li>
              <li><strong className="text-white">Deletion</strong> — delete your account and all associated data from Settings</li>
              <li><strong className="text-white">Portability</strong> — export your conversations, memory, and agent data in standard formats</li>
              <li><strong className="text-white">Objection</strong> — opt out of non-essential data processing</li>
              <li><strong className="text-white">Complaint</strong> — lodge a complaint with a supervisory authority (EU/UK/CA users)</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:build@usedopl.com" className="underline text-white hover:text-white/60 transition-colors">build@usedopl.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">8. Cookies and Local Storage</h2>
            <p>
              We use essential cookies and browser local storage for authentication, session management, and user preferences. We do not use tracking cookies, advertising pixels, or third-party analytics. You may disable cookies in your browser settings, but this may impair core Service functionality.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">9. Data Retention</h2>
            <p>
              We retain your data for as long as your account remains active. If you delete your account, your data remains available for export for 30 days, after which it is permanently and irreversibly deleted from our systems. Anonymized, aggregated usage statistics may be retained indefinitely for service improvement purposes.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">10. Children&rsquo;s Privacy</h2>
            <p>
              The Service is not directed to individuals under 18 years of age. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us immediately and we will take steps to delete such information.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">11. International Data Transfers</h2>
            <p>
              If you access the Service from outside the United States, your information may be transferred to, stored, and processed in the United States. By using the Service, you consent to such transfers. We take reasonable steps to ensure your data receives an adequate level of protection in accordance with applicable data protection laws.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">12. California Privacy Rights (CCPA)</h2>
            <p>
              California residents have the right to know what personal information is collected, request its deletion, and opt out of its sale. We do not sell personal information. To exercise your California privacy rights, contact us at the address below.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">13. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes via email or through an in-app notification. Your continued use of the Service after changes take effect constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">14. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or your data, contact us at{" "}
              <a href="mailto:build@usedopl.com" className="underline text-white hover:text-white/60 transition-colors">
                build@usedopl.com
              </a>
            </p>
            <p className="mt-2 text-white/50">
              Dopl AI Companion<br />
              2603 California Street<br />
              San Francisco, CA
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-8 mt-16 border-t border-white/10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <p className="font-mono text-[10px] text-white/30">© 2026 Dopl AI Companion</p>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="font-mono text-[10px] text-white/30 hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy" className="font-mono text-[10px] text-white/30 hover:text-white transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
