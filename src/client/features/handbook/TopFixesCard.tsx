import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ListChecks } from "lucide-react";
import { CardShell } from "@/client/components/CardShell";
import { EmptyState } from "@/client/components/EmptyState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { browserStorage, fixFindings, loadDone, topFixes } from "./fixList";
import { SEVERITY_LABELS } from "./labels";
import { handbookRunQuery, handbookRunsQuery } from "./queries";

const icon = <ListChecks className="size-4" />;

/**
 * Dashboard "Your top 5 fixes" (B14 WO-B14-006, A13): the latest completed
 * check's first Must / Should fixes, or a button to run the first check.
 */
export function TopFixesCard({ projectId }: { projectId: string }) {
  const runsQuery = useQuery(handbookRunsQuery(projectId));
  const latest = runsQuery.data?.find((r) => r.status === "completed");
  // Hidden while loading or on error: the dashboard's own cards matter more.
  if (!runsQuery.data) return null;
  if (!latest)
    return (
      <CardShell title="Your top 5 fixes" icon={icon}>
        <EmptyState
          variant="plain"
          icon={ListChecks}
          title="See what to fix first"
          description="One check reads your site and lists its SEO, GEO and AEO problems, most important first."
          action={
            <Button
              nativeButton={false}
              render={
                <Link
                  to="/p/$projectId/handbook/check"
                  params={{ projectId }}
                />
              }
            >
              Check your site
            </Button>
          }
        />
      </CardShell>
    );
  return <LatestTopFixes projectId={projectId} runId={latest.id} />;
}

function LatestTopFixes({
  projectId,
  runId,
}: {
  projectId: string;
  runId: string;
}) {
  const runQuery = useQuery(handbookRunQuery(projectId, runId));
  const [done, setDone] = useState<Set<string>>(() => new Set());
  // Read after mount so the server render and first client render match.
  useEffect(() => {
    const storage = browserStorage();
    setDone(storage ? loadDone(runId, storage) : new Set());
  }, [runId]);
  const report = runQuery.data?.report;
  if (!report) return null;
  const rows = topFixes(fixFindings(report), done);
  return (
    <CardShell
      title="Your top 5 fixes"
      icon={icon}
      action={
        <Link
          to="/p/$projectId/handbook/$runId"
          params={{ projectId, runId }}
          className="text-sm underline"
        >
          See full fix list
        </Link>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing left to fix first. The full list has the smaller items.
        </p>
      ) : (
        <ol className="space-y-2">
          {rows.map(({ title, findings: [f] }) => (
            <li key={f.code} className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant={f.severity === "S1" ? "destructive" : "secondary"}
              >
                {SEVERITY_LABELS[f.severity].label}
              </Badge>
              {(f.categories ?? []).map((c) => (
                <Badge key={c} variant="outline">
                  {c}
                </Badge>
              ))}
              <span className="text-sm font-medium">{title}</span>
            </li>
          ))}
        </ol>
      )}
    </CardShell>
  );
}
