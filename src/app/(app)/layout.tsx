import { Header } from "@/components/layout/header";
import { GlobalSearch } from "@/components/search/global-search";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { ToastProvider } from "@/contexts/toast-context";
import { ToastContainer } from "@/components/ui/toast-container";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <Header />
      <main className="pt-16 min-h-screen bg-[#0a0a0f]">{children}</main>
      <GlobalSearch />
      <KeyboardShortcuts />
      <ToastContainer />
    </ToastProvider>
  );
}
