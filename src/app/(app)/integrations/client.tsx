"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Integration, IntegrationAccount } from "@/types/integration";
import { IntegrationGridSkeleton } from "@/components/skeletons/integration-skeleton";

interface IntegrationsPageClientProps {
  initialIntegrations: Integration[];
  isLoading?: boolean;
}

export default function IntegrationsPageClient({ initialIntegrations, isLoading = false }: IntegrationsPageClientProps) {
  const [items, setItems] = useState(initialIntegrations);
  const toast = useToast();

  const addAccount = (integrationId: string) => {
    // In a real app, this would trigger OAuth flow
    // For now, we'll simulate adding a mock account
    const mockEmail = "user" + Date.now() + "@example.com";
    const integration = items.find(i => i.id === integrationId);
    
    setItems((prev) =>
      prev.map((item) =>
        item.id === integrationId
          ? {
              ...item,
              status: "connected" as const,
              accounts: [
                ...item.accounts,
                {
                  id: String(item.accounts.length + 1),
                  email: mockEmail,
                  connectedAt: "Just now",
                } as IntegrationAccount,
              ],
              last_sync: "Just now",
            }
          : item
      )
    );
    
    toast.success("Account connected", `${integration?.name || "Integration"} account added`);
  };

  const disconnectAccount = (integrationId: string, accountId: string) => {
    const integration = items.find(i => i.id === integrationId);
    const account = integration?.accounts.find(a => a.id === accountId);
    
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== integrationId) return item;
        const newAccounts = item.accounts.filter((acc) => acc.id !== accountId);
        return {
          ...item,
          accounts: newAccounts,
          status: newAccounts.length > 0 ? "connected" as const : "disconnected" as const,
        };
      })
    );
    
    toast.info("Account disconnected", `${account?.email || "Account"} removed from ${integration?.name || "integration"}`);
  };

  // Extract scopes from config if available
  const getScopes = (item: Integration): string[] => {
    const config = item.config as { scopes?: string[] };
    return config?.scopes || [];
  };

  const hasIntegrations = items.length > 0;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
            Integrations
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
            Connected services and OAuth
          </p>
        </div>
        <Link href="/integrations/add">
          <Button variant="solid">
            <span className="mr-1">+</span> Add Integration
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <IntegrationGridSkeleton count={6} />
      ) : hasIntegrations ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[rgba(58,58,56,0.2)]">
          {items.map((integration) => {
            const accountCount = integration.accounts.length;
            const badgeText = integration.status === "connected" 
              ? accountCount + " Connected" 
              : "Disconnected";
            
            return (
              <Card
                key={integration.id}
                label={integration.icon}
                accentColor={integration.status === "connected" ? "#9EFFBF" : undefined}
                bordered={false}
              >
                <div className="mt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-header text-lg font-bold tracking-tight">
                      {integration.name}
                    </h3>
                    <Badge status={integration.status === "connected" ? "active" : "inactive"}>
                      {badgeText}
                    </Badge>
                  </div>

                  {/* Connected Accounts Section */}
                  <div className="mt-4">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-grid/40">
                      Connected Accounts
                    </span>

                    {integration.accounts.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {integration.accounts.map((account) => (
                          <div
                            key={account.id}
                            className="flex items-center justify-between py-1.5 px-2 border border-[rgba(58,58,56,0.1)] bg-cream/30"
                          >
                            <div className="flex flex-col">
                              <span className="font-mono text-xs text-grid">
                                {account.email || account.name || "Account"}
                              </span>
                              <span className="font-mono text-[9px] text-grid/40">
                                Connected {account.connectedAt}
                              </span>
                            </div>
                            <button
                              onClick={() => disconnectAccount(integration.id, account.id)}
                              className="font-mono text-[10px] uppercase tracking-wide text-coral hover:text-coral/70 transition-colors px-2 py-1 border border-coral/20 hover:border-coral/40"
                            >
                              Disconnect
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 font-mono text-[11px] text-grid/40 italic">
                        No accounts connected
                      </p>
                    )}

                    {/* Add Account Button */}
                    <button
                      onClick={() => addAccount(integration.id)}
                      className="mt-3 w-full py-2 px-3 font-mono text-[11px] uppercase tracking-wide text-forest border border-forest/30 hover:bg-forest/5 transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="text-base leading-none">+</span>
                      <span>Add Account</span>
                    </button>
                  </div>

                  {/* Scopes Section - only show if accounts connected */}
                  {integration.status === "connected" && getScopes(integration).length > 0 && (
                    <div className="mt-4">
                      <span className="font-mono text-[10px] uppercase tracking-wide text-grid/40">
                        Scopes
                      </span>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {getScopes(integration).map((scope) => (
                          <span
                            key={scope}
                            className="font-mono text-[10px] bg-forest/5 px-2 py-0.5 border border-[rgba(58,58,56,0.1)]"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="font-mono text-[10px] text-grid/40 mt-4">
                    Last sync: {integration.last_sync || "Never"}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="border border-[rgba(58,58,56,0.2)] bg-paper p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 border border-[rgba(58,58,56,0.2)] flex items-center justify-center">
            <span className="text-2xl">🔗</span>
          </div>
          <h2 className="font-header text-xl font-bold mb-2">No integrations connected</h2>
          <p className="text-sm text-grid/50 mb-6 max-w-md mx-auto">
            Connect external services like Google Workspace, Slack, or GitHub to give your agent access to your tools and data.
          </p>
          <Link href="/integrations/add">
            <Button variant="solid">
              <span className="mr-1">+</span> Add Integration
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
