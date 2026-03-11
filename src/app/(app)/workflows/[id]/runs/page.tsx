import { createClient } from "@/lib/supabase/server";
import { getWorkflowById, getWorkflowRuns } from "@/lib/supabase/data";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { generateBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch {
    return timestamp;
  }
}

function formatDuration(startedAt: string, completedAt?: string): string {
  if (!completedAt) return "In progress...";
  
  try {
    const start = new Date(startedAt);
    const end = new Date(completedAt);
    const diffMs = end.getTime() - start.getTime();
    
    if (diffMs < 1000) return "<1s";
    if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s`;
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ${Math.floor((diffMs % 60000) / 1000)}s`;
    
    return `${Math.floor(diffMs / 3600000)}h ${Math.floor((diffMs % 3600000) / 60000)}m`;
  } catch {
    return "—";
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 size={16} className="text-green-600" />;
    case "failed":
      return <XCircle size={16} className="text-red-600" />;
    case "running":
      return <Loader2 size={16} className="text-blue-600 animate-spin" />;
    default:
      return <Clock size={16} className="text-gray-400" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-green-50 text-green-700 border-green-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    running: "bg-blue-50 text-blue-700 border-blue-200",
    pending: "bg-gray-50 text-gray-700 border-gray-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono uppercase border ${
        styles[status] || styles.pending
      }`}
    >
      <StatusIcon status={status} />
      {status}
    </span>
  );
}

export default async function WorkflowRunsPage({ params }: PageProps) {
  const { id } = await params;
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect("/login");
  }

  const workflow = await getWorkflowById(id);
  
  if (!workflow) {
    return (
      <div className="p-6">
        <Breadcrumbs 
          items={[
            { label: "Home", href: "/" },
            { label: "Workflows", href: "/workflows" },
            { label: "Not Found" },
          ]} 
        />
        <div className="text-center py-12">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Workflow Not Found</h2>
          <p className="text-gray-600">The workflow you are looking for does not exist.</p>
        </div>
      </div>
    );
  }

  const runs = await getWorkflowRuns(id, 50);

  // Build breadcrumbs with workflow name
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Workflows", href: "/workflows" },
    { label: workflow.name, href: `/workflows/${id}` },
    { label: "Run History" },
  ];

  return (
    <div className="p-6">
      <Breadcrumbs items={breadcrumbItems} />

      <div className="mb-6">
        <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
          {workflow.name}
        </h1>
        <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
          Run History
        </p>
      </div>

      {runs.length === 0 ? (
        <div className="border border-[rgba(58,58,56,0.2)] bg-white p-12 text-center">
          <Clock size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">No runs yet</h3>
          <p className="text-gray-600 text-sm">
            This workflow hasn&apos;t been executed yet. Run it from the workflow page.
          </p>
          <Link
            href={`/workflows/${id}`}
            className="inline-block mt-4 px-4 py-2 bg-forest text-white text-sm font-mono uppercase tracking-wide hover:bg-forest/90 transition-colors"
          >
            Go to Workflow
          </Link>
        </div>
      ) : (
        <div className="border border-[rgba(58,58,56,0.2)] bg-white">
          <table className="w-full">
            <thead className="border-b border-[rgba(58,58,56,0.2)]">
              <tr className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
                <th className="text-left p-4">Run ID</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Started</th>
                <th className="text-left p-4">Duration</th>
                <th className="text-left p-4">Output</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run, index) => (
                <tr 
                  key={run.id}
                  className={index !== runs.length - 1 ? "border-b border-[rgba(58,58,56,0.1)]" : ""}
                >
                  <td className="p-4">
                    <code className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {run.id.substring(0, 8)}...
                    </code>
                  </td>
                  <td className="p-4">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="p-4 text-sm text-gray-700">
                    {formatTimestamp(run.started_at)}
                  </td>
                  <td className="p-4 text-sm text-gray-600 font-mono">
                    {formatDuration(run.started_at, run.completed_at)}
                  </td>
                  <td className="p-4 text-sm text-gray-600 max-w-xs truncate">
                    {run.output ? (
                      <details className="cursor-pointer">
                        <summary className="text-forest hover:underline">
                          View output
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-32">
                          {JSON.stringify(run.output, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
