import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, Playfair_Display } from "next/font/google";
import { ErrorBoundary } from "@/components/error/error-boundary";
import { ToastProvider } from "@/contexts/toast-context";
import { SearchProvider } from "@/contexts/search-context";
import { ToastContainer } from "@/components/ui/toast-container";
import { GlobalSearch } from "@/components/search/global-search";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-header",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Dopl — Your AI Companion",
    template: "%s — Dopl",
  },
  description: "A fully autonomous AI companion that connects to your apps, manages your workflow, and gets things done. Google, Slack, GitHub, and 100+ integrations.",
  metadataBase: new URL("https://usedopl.com"),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Dopl — Your AI Companion",
    description: "A fully autonomous AI companion that connects to your apps, manages your workflow, and gets things done.",
    url: "https://usedopl.com",
    siteName: "Dopl",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Dopl AI Companion",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dopl — Your AI Companion",
    description: "A fully autonomous AI companion that connects to your apps, manages your workflow, and gets things done.",
    images: ["/og-image.jpg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dopl",
  },
  other: {
    "theme-color": "#0a0a0f",
    "msapplication-TileColor": "#0a0a0f",
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${playfairDisplay.variable}`}>
      <body className="bg-[#0a0a0f] text-forest antialiased">
        <ToastProvider>
          <SearchProvider>
            <ErrorBoundary>
              <main className="min-h-screen">{children}</main>
              <GlobalSearch />
              <KeyboardShortcuts />
            </ErrorBoundary>
            <ToastContainer />
          </SearchProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
// build 1773084604
