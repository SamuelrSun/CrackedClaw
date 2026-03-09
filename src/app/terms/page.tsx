import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — CrackedClaw",
  description: "CrackedClaw Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-paper text-forest">
      {/* Nav */}
      <nav className="border-b border-[rgba(58,58,56,0.15)] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-mono text-sm font-semibold tracking-tight hover:opacity-80 transition-opacity">
            CrackedClaw
          </Link>
          <Link href="/login" className="font-mono text-xs text-grid/60 hover:text-forest transition-colors">
            Sign in →
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="font-mono text-2xl font-bold mb-2 tracking-tight">Terms of Service</h1>
        <p className="font-mono text-xs text-grid/50 mb-12">Last updated: March 2025</p>

        <div className="space-y-10 font-mono text-sm leading-relaxed text-forest/90">
          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">1. Acceptance of Terms</h2>
            <p>
              By accessing or using CrackedClaw (&ldquo;Service&rdquo;), operated by CrackedClaw Inc. (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">2. Description of Service</h2>
            <p>
              CrackedClaw provides a cloud-hosted AI agent platform that allows users to deploy, manage, and interact with AI agents. The Service includes agent provisioning, conversation history, memory management, workflow automation, and integrations with third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">3. Eligibility</h2>
            <p>
              You must be at least 18 years old and capable of forming a binding contract to use the Service. By using the Service, you represent that you meet these requirements.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">4. Account Registration</h2>
            <p className="mb-2">You agree to provide accurate information and maintain the security of your account credentials. You are responsible for all activity under your account.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">5. Acceptable Use</h2>
            <p>You may not use the Service to violate laws, infringe intellectual property, generate harmful content, attempt unauthorized access, distribute malware, or resell the Service without consent.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">6. Subscription and Billing</h2>
            <p>Paid subscriptions are billed on a recurring basis. Fees are non-refundable unless required by law. We may change pricing with 30 days notice.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">7. Data and Privacy</h2>
            <p>
              Your use of the Service is also governed by our{" "}
              <Link href="/privacy" className="underline hover:text-mint transition-colors">
                Privacy Policy
              </Link>
              . You retain ownership of your data. We process your data solely to provide the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">8. Intellectual Property</h2>
            <p>The Service and its code, design, and content are owned by the Company. You may not copy, modify, or distribute any part without written permission.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">9. Termination</h2>
            <p>We may suspend or terminate accounts for violations of these Terms. You may cancel at any time through Settings. Data is exportable for 30 days after termination.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">10. Disclaimer of Warranties</h2>
            <p>THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTIES OF ANY KIND. YOUR USE OF THE SERVICE IS AT YOUR OWN RISK.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">11. Limitation of Liability</h2>
            <p>OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE PAST 12 MONTHS. WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">12. Governing Law</h2>
            <p>These Terms are governed by California law. Disputes shall be resolved in courts located in San Francisco, California.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3 text-forest">13. Contact</h2>
            <p>
              Questions? Email{" "}
              <a href="mailto:legal@crackedclaw.com" className="underline hover:text-mint transition-colors">
                legal@crackedclaw.com
              </a>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-[rgba(58,58,56,0.1)] px-6 py-8 mt-16">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <p className="font-mono text-[10px] text-grid/40">© 2025 CrackedClaw Inc.</p>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="font-mono text-[10px] text-grid/40 hover:text-forest transition-colors">Terms</Link>
            <Link href="/privacy" className="font-mono text-[10px] text-grid/40 hover:text-forest transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
