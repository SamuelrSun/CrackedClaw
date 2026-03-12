import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
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
  title: "Dopl",
  description: "AI Agent Management Platform",
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
