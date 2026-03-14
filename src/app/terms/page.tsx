import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Dopl",
  description: "Dopl AI Companion Terms of Service",
};

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="font-mono text-[11px] text-white/40 uppercase tracking-wide mb-12">
          Last updated: March 2026
        </p>

        <div className="space-y-10 font-mono text-[13px] leading-relaxed text-white/80">
          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Dopl AI Companion (&ldquo;Service&rdquo;), operated by Dopl AI Companion (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, do not access or use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">2. Description of Service</h2>
            <p>
              Dopl provides a cloud-hosted AI companion platform that allows users to deploy, manage, and interact with personal AI agents. The Service includes agent provisioning, conversation history, persistent memory, workflow automation, and integrations with third-party services including email, calendar, messaging, and productivity tools.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">3. Eligibility</h2>
            <p>
              You must be at least 18 years of age and capable of forming a legally binding contract to use the Service. By creating an account, you represent and warrant that you meet these requirements.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">4. Account Registration</h2>
            <p>
              You agree to provide accurate, current, and complete information during registration and to keep your account credentials secure. You are solely responsible for all activity that occurs under your account. You must notify us immediately of any unauthorized use.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">5. Acceptable Use</h2>
            <p className="mb-2">You agree not to use the Service to:</p>
            <ul className="list-disc pl-5 space-y-1 text-white/70">
              <li>Violate any applicable law, regulation, or third-party rights</li>
              <li>Generate, store, or distribute harmful, abusive, or illegal content</li>
              <li>Attempt to gain unauthorized access to the Service or other users&rsquo; accounts</li>
              <li>Reverse-engineer, decompile, or disassemble any part of the Service</li>
              <li>Use the Service for automated scraping, spamming, or mass outreach without consent</li>
              <li>Resell, sublicense, or redistribute the Service without written authorization</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">6. Subscription and Billing</h2>
            <p>
              The Service offers both free and paid subscription tiers. Paid subscriptions are billed on a recurring monthly basis through Stripe. All fees are non-refundable except as required by applicable law. We reserve the right to modify pricing with at least 30 days&rsquo; prior notice. Continued use of the Service after a price change constitutes acceptance of the new pricing.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">7. Data and Privacy</h2>
            <p>
              Your use of the Service is also governed by our{" "}
              <Link href="/privacy" className="underline text-white hover:text-white/60 transition-colors">
                Privacy Policy
              </Link>
              . You retain all ownership rights to the data you provide to the Service. We process your data solely to provide, maintain, and improve the Service.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">8. AI-Generated Content</h2>
            <p>
              The Service uses artificial intelligence to generate responses, perform actions, and automate tasks on your behalf. AI-generated outputs may contain errors or inaccuracies. You acknowledge that you are responsible for reviewing and verifying any AI-generated content before relying on it. We make no warranties regarding the accuracy, completeness, or reliability of AI outputs.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">9. Third-Party Integrations</h2>
            <p>
              The Service may integrate with third-party platforms (Gmail, Google Calendar, LinkedIn, GitHub, etc.). Your use of these integrations is subject to the respective third-party terms and privacy policies. We are not responsible for the availability, accuracy, or practices of third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">10. Intellectual Property</h2>
            <p>
              The Service, including its source code, design, branding, and documentation, is the intellectual property of the Company. Nothing in these Terms grants you any right to use our trademarks, logos, or brand elements without written permission.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">11. Termination</h2>
            <p>
              We may suspend or terminate your account at any time for violations of these Terms or for any reason with reasonable notice. You may cancel your account at any time through your account settings. Upon termination, your data will remain available for export for 30 days, after which it will be permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">12. Disclaimer of Warranties</h2>
            <p className="uppercase text-[11px] text-white/60 leading-relaxed">
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, whether express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Service will be uninterrupted, secure, or error-free.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">13. Limitation of Liability</h2>
            <p className="uppercase text-[11px] text-white/60 leading-relaxed">
              To the maximum extent permitted by law, our total aggregate liability for any claims arising from or related to the Service shall not exceed the total amount you paid us in the twelve (12) months preceding the claim. We shall not be liable for any indirect, incidental, special, consequential, or punitive damages.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">14. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of the State of California, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be resolved in the state or federal courts located in San Francisco, California.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">15. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of material changes via email or through the Service. Your continued use of the Service after changes take effect constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold mb-3 text-white">16. Contact</h2>
            <p>
              If you have questions about these Terms, contact us at{" "}
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
