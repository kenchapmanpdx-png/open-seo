import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ListChecks } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { HelpLabel } from "@/client/components/HelpLabel";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { downloadFile } from "@/client/lib/download";
import {
  HANDBOOK_CATEGORIES,
  type ReportJson,
} from "@/server/features/handbook/contracts/exports";
import {
  blockedCauses,
  blockedItems,
  buildFixGroups,
  capNote,
  checksCount,
  fixFindings,
  fixListCsv,
  browserStorage,
  loadDone,
  notFinalNote,
  provisionalReason,
  saveDone,
  unreadSiteReason,
  type CategoryFilter,
} from "./fixList";
import { STATUS_LABELS } from "./labels";
import { FixRow, MergedFixRow } from "./FixRows";
import { RunFullAuditButton } from "./RunFullAuditButton";

const FILTERS: CategoryFilter[] = ["all", ...HANDBOOK_CATEGORIES];

/**
 * Fix List (B14 WO-B14-003): a completed run as a prioritised to-do list.
 * Done checkboxes are kept in this browser only.
 */
export function FixList({
  projectId,
  runId,
  report,
  notes,
  runDate,
  newerRunId = null,
}: {
  projectId: string;
  runId: string;
  report: ReportJson;
  /** Cap notes and similar run notes shown under the header. */
  notes: string[];
  /** When the run started (the "not final" note names it). */
  runDate: string;
  /** A newer completed check of the same site, if any. */
  newerRunId?: string | null;
}) {
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [done, setDone] = useState<Set<string>>(() => new Set());
  // Read after mount so the server render and first client render match.
  useEffect(() => {
    const storage = browserStorage();
    setDone(storage ? loadDone(runId, storage) : new Set());
  }, [runId]);
  const findings = fixFindings(report);
  const groups = buildFixGroups(findings, filter, done);
  const blockedCount = blockedItems(report).length;
  const causes = blockedCauses(report);
  const notFinal = notFinalNote({
    reason: provisionalReason(report),
    runDate,
    newerRunId,
  });

  /** Merged rows toggle all their findings at once. */
  const toggle = (codes: string[], checked: boolean) => {
    const next = new Set(done);
    for (const code of codes) {
      if (checked) next.add(code);
      else next.delete(code);
    }
    setDone(next);
    const storage = browserStorage();
    if (storage) saveDone(runId, next, storage);
  };

  const unread = unreadSiteReason(report);
  if (unread)
    return (
      <div className="space-y-4">
        <Alert variant="warning">
          <AlertTitle>The site could not be read</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              No page was read, so there is no grade and no fix list. Reason:{" "}
              {unread}
            </p>
            <RunFullAuditButton projectId={projectId} label="Check again" />
          </AlertDescription>
        </Alert>
      </div>
    );

  return (
    <div className="space-y-4">
      <FixListHeader report={report} />
      {notFinal ? (
        <Alert variant="warning">
          <AlertTitle>{notFinal.title}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{notFinal.body}</p>
            <div className="flex flex-wrap items-center gap-3">
              <RunFullAuditButton projectId={projectId} label="Check again" />
              {notFinal.newerRunId ? (
                <Link
                  to="/p/$projectId/handbook/$runId"
                  params={{ projectId, runId: notFinal.newerRunId }}
                  className="text-sm underline"
                >
                  A newer check exists
                </Link>
              ) : null}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      {notes.map((note) => (
        <p key={note} className="text-sm text-muted-foreground">
          {note}
        </p>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={findings.length === 0}
            onClick={() =>
              downloadFile(fixListCsv(findings), "fix-list.csv", "text/csv")
            }
          >
            Download CSV
          </Button>
        </div>
      </div>
      {findings.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Nothing to fix"
          description="Every automated check passed or did not apply."
        />
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <span
                aria-hidden
                className={`size-2.5 rounded-full ${GROUP_MARKER[group.key]}`}
              />
              <HelpLabel
                label={`${group.label} (${group.rows.length})`}
                helpText={group.help}
              />
            </h3>
            {group.rows.map((row) =>
              row.findings.length === 1 ? (
                <FixRow
                  key={row.findings[0].code}
                  finding={row.findings[0]}
                  done={row.done}
                  onDone={(checked) => toggle([row.findings[0].code], checked)}
                />
              ) : (
                <MergedFixRow
                  key={row.findings[0].code}
                  row={row}
                  doneCodes={done}
                  onDone={toggle}
                />
              ),
            )}
          </section>
        ))
      )}
      {blockedCount ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            <HelpLabel
              label={`${STATUS_LABELS.BLOCKED.label} (${blockedCount})`}
              helpText={STATUS_LABELS.BLOCKED.help}
            />
          </h3>
          <ul className="space-y-2 text-sm">
            {causes.map((cause) => (
              <li key={cause.key}>
                <span className="font-medium">{cause.label}</span> —{" "}
                {checksCount(cause.items.length)}. {cause.action}
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Details
                  </summary>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {cause.items.map((item) => (
                      <li key={item.itemId}>
                        <span className="font-mono">{item.itemId}</span>{" "}
                        {item.note ?? "No reason recorded."}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <RunFullAuditButton projectId={projectId} label="Check again" />
    </div>
  );
}

function FixListHeader({ report }: { report: ReportJson }) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <ScoreTile
        label="Overall"
        score={report.score?.final ?? null}
        value={
          report.score ? `${report.score.grade} · ${report.score.final}` : "—"
        }
        note={
          report.score?.capReason
            ? `${report.score.uncapped} before the must-fix cap. ${capNote(report)}`
            : null
        }
      />
      {HANDBOOK_CATEGORIES.map((c) => {
        const score = report.categoryScores?.[c] ?? null;
        return (
          <ScoreTile
            key={c}
            label={c}
            score={score}
            value={score === null ? "—" : String(score)}
          />
        );
      })}
    </div>
  );
}

/** Score tile edge by grade band (WO-B16-006): green ≥ 80, amber ≥ 50, red. */
function bandEdge(score: number | null) {
  if (score === null) return "";
  if (score >= 80) return "border-l-4 border-l-success";
  if (score >= 50) return "border-l-4 border-l-warning";
  return "border-l-4 border-l-destructive";
}

function ScoreTile({
  label,
  value,
  score,
  note = null,
}: {
  label: string;
  value: string;
  score: number | null;
  /** WO-B19-011: the uncapped score next to a capped grade. */
  note?: string | null;
}) {
  return (
    <Card className={bandEdge(score)}>
      <CardContent className="space-y-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {note ? (
          <div className="text-xs text-muted-foreground">{note}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Group header marker: Must red, Should amber, Nice neutral (WO-B16-006). */
const GROUP_MARKER: Record<string, string> = {
  must: "bg-destructive",
  should: "bg-warning",
  nice: "bg-muted-foreground/50",
};
