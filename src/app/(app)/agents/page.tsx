import { AgentsClient } from "./client";

export const metadata = {
  title: "Agents — Dopl",
  description: "Spatial agent canvas. Spawn and manage AI agents.",
};

export default function AgentsPage() {
  return <AgentsClient />;
}
