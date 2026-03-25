import { Metadata } from "next";
import DocsPageClient from "./client";

export const metadata: Metadata = {
  title: "Docs — Dopl",
  description: "Everything you need to know about your AI companion.",
};

export default function DocsPage() {
  return <DocsPageClient />;
}
