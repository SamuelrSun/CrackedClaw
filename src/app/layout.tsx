import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/layout/header";
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

export const metadata: Metadata = {
  title: "OpenClaw Cloud",
  description: "AI Agent Management Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-paper text-forest antialiased">
        <ToastProvider>
          <SearchProvider>
            <ErrorBoundary>
              <Header />
              <main className="pt-14 min-h-screen mosaic-bg">{children}</main>
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
