import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryState } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
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
import { CopyRulesDialog } from "./CopyRulesDialog";
import { HandbookSettingsCard } from "./HandbookSettingsCard";
import { RunFullAuditButton } from "./RunFullAuditButton";
import { FixList } from "./FixList";
import { MORE_TOOLS } from "./labels";
import {
  handbookRunQuery,
  handbookRunsQuery,
  handbookSettingsQuery,
} from "./queries";

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
          actions={<MoreToolsMenu projectId={projectId} />}
        />
        <QueryState query={runsQuery} errorFallback="Failed to load runs">
          {(runs) => {
            const latest = runs.find((r) => r.status === "completed");
            return (
              <>
                {latest ? (
                  <LatestFixList projectId={projectId} runId={latest.id} />
                ) : (
                  <RunFullAuditButton projectId={projectId} />
                )}
                <h2 className="pt-2 text-lg font-semibold">Past checks</h2>
                <RunsTable projectId={projectId} runs={runs} />
              </>
            );
          }}
        </QueryState>
        <QueryState
          query={settingsQuery}
          errorFallback="Failed to load handbook settings"
        >
          {(settings) => (
            <HandbookSettingsCard projectId={projectId} settings={settings} />
          )}
        </QueryState>
      </div>
    </div>
  );
}

/**
 * One "More tools" menu instead of a row of route-named buttons (B16
 * WO-B16-001): same routes, plain names, one line on what each does.
 */
function MoreToolsMenu({ projectId }: { projectId: string }) {
  const [rulesOpen, setRulesOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          More tools <ChevronDown className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          {MORE_TOOLS.map((tool) => {
            const text = (
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{tool.label}</span>
                <span className="text-xs text-muted-foreground">
                  {tool.help}
                </span>
              </div>
            );
            return tool.to === null ? (
              <DropdownMenuItem
                key={tool.label}
                onClick={() => setRulesOpen(true)}
              >
                {text}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                key={tool.label}
                render={
                  <Link
                    to={`/p/$projectId/handbook/${tool.to}`}
                    params={{ projectId }}
                  />
                }
              >
                {text}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <CopyRulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />
    </>
  );
}

/** The latest completed run's Fix List (WO-B14-003) above the run history. */
function LatestFixList({
  projectId,
  runId,
}: {
  projectId: string;
  runId: string;
}) {
  const runQuery = useQuery(handbookRunQuery(projectId, runId));
  return (
    <QueryState query={runQuery} errorFallback="Failed to load the fix list">
      {(detail) =>
        detail ? (
          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">
                Fix list · {detail.run.origin}
              </h2>
              <Link
                to="/p/$projectId/handbook/$runId"
                params={{ projectId, runId }}
                className="text-sm underline"
              >
                {new Date(detail.run.startedAt).toLocaleString()} · open full
                results
              </Link>
            </div>
            <FixList
              projectId={projectId}
              runId={runId}
              report={detail.report}
              notes={detail.capNotes}
              runDate={detail.run.startedAt}
            />
          </section>
        ) : null
      }
    </QueryState>
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
                {run.capNotes.map((note) => (
                  <p
                    key={note}
                    className="mt-1 max-w-sm text-xs text-muted-foreground"
                  >
                    {note}
                  </p>
                ))}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {run.findingsCount}
              </TableCell>
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
