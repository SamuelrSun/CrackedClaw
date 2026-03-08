import { Header } from "@/components/layout/header";
import { GlobalSearch } from "@/components/search/global-search";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="pt-14 min-h-screen mosaic-bg">{children}</main>
      <GlobalSearch />
      <KeyboardShortcuts />
    </>
  );
}
