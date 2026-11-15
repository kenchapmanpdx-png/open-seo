import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryState } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { formatRelativeTime } from "@/client/lib/relative-time";
import { HandbookSettingsCard } from "./HandbookSettingsCard";
import { handbookRunsQuery, handbookSettingsQuery } from "./queries";

type Runs = Awaited<
  ReturnType<NonNullable<ReturnType<typeof handbookRunsQuery>["queryFn"]>>
>;

/** Project handbook tab (ADR-010): settings + recent runs. */
export function HandbookRunsPage({ projectId }: { projectId: string }) {
  const settingsQuery = useQuery(handbookSettingsQuery(projectId));
  const runsQuery = useQuery(handbookRunsQuery(projectId));

  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title="Handbook"
          description="SEO/GEO handbook checks with evidence for every finding."
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    to="/p/$projectId/handbook/overview"
                    params={{ projectId }}
                  />
                }
              >
                Overview
              </Button>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    to="/p/$projectId/handbook/ai-traffic"
                    params={{ projectId }}
                  />
                }
              >
                AI traffic
              </Button>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    to="/p/$projectId/handbook/bing"
                    params={{ projectId }}
                  />
                }
              >
                Bing
              </Button>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    to="/p/$projectId/handbook/ai-visibility-byok"
                    params={{ projectId }}
                  />
                }
              >
                AI visibility (own keys)
              </Button>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    to="/p/$projectId/handbook/backlinks-cc"
                    params={{ projectId }}
                  />
                }
              >
                Backlinks (Common Crawl)
              </Button>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    to="/p/$projectId/handbook/agency"
                    params={{ projectId }}
                  />
                }
              >
                Agency
              </Button>
            </>
          }
        />
        <QueryState
          query={settingsQuery}
          errorFallback="Failed to load handbook settings"
        >
          {(settings) => (
            <HandbookSettingsCard projectId={projectId} settings={settings} />
          )}
        </QueryState>
        <QueryState query={runsQuery} errorFallback="Failed to load runs">
          {(runs) => <RunsTable projectId={projectId} runs={runs} />}
        </QueryState>
      </div>
    </div>
  );
}

function RunsTable({ projectId, runs }: { projectId: string; runs: Runs }) {
  if (runs.length === 0)
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No handbook runs yet"
        description="Enable the handbook above; the next site audit of this project runs it."
      />
    );
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Started</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Findings</TableHead>
            <TableHead>Grade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell className="whitespace-nowrap">
                <Link
                  to="/p/$projectId/handbook/$runId"
                  params={{ projectId, runId: run.id }}
                  className="font-medium hover:underline"
                >
                  {formatRelativeTime(run.startedAt)}
                </Link>
              </TableCell>
              <TableCell>{run.mode}</TableCell>
              <TableCell>{run.tier ?? "—"}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    run.status === "failed"
                      ? "destructive"
                      : run.status === "completed"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {run.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {run.findingsCount}
              </TableCell>
              {/* Grade is computed in B3 (scoring); placeholder until then. */}
              <TableCell className="text-muted-foreground">
                {run.grade ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}
