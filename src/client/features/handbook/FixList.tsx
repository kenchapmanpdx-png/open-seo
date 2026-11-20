import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { HelpLabel } from "@/client/components/HelpLabel";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Checkbox } from "@/client/components/ui/checkbox";
import { downloadFile } from "@/client/lib/download";
import {
  HANDBOOK_CATEGORIES,
  type ReportJson,
} from "@/server/features/handbook/contracts/exports";
import {
  blockedItems,
  buildFixGroups,
  fixFindings,
  fixListCsv,
  loadDone,
  provisionalReason,
  saveDone,
  type CategoryFilter,
  type Finding,
} from "./fixList";
import { AI_JUDGED, SEVERITY_LABELS, STATUS_LABELS } from "./labels";
import { RunFullAuditButton } from "./RunFullAuditButton";

const PAGE_PREVIEW = 20;
const FILTERS: CategoryFilter[] = ["all", ...HANDBOOK_CATEGORIES];

/** `window.localStorage` itself throws in some sandboxed frames. */
function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Fix List (B14 WO-B14-003): a completed run as a prioritised to-do list.
 * Done checkboxes are kept in this browser only.
 */
export function FixList({
  projectId,
  runId,
  report,
  notes,
}: {
  projectId: string;
  runId: string;
  report: ReportJson;
  /** Cap notes and similar run notes shown under the header. */
  notes: string[];
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
  const blocked = blockedItems(report);
  const provisional = provisionalReason(report);

  const toggle = (code: string, checked: boolean) => {
    const next = new Set(done);
    if (checked) next.add(code);
    else next.delete(code);
    setDone(next);
    const storage = browserStorage();
    if (storage) saveDone(runId, next, storage);
  };

  return (
    <div className="space-y-4">
      <FixListHeader report={report} />
      {provisional ? (
        <Alert variant="warning">
          <AlertTitle>Grade provisional</AlertTitle>
          <AlertDescription>
            Browser checks skipped: {provisional}.
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
          <section key={group.key} className="space-y-2">
            <h3 className="text-sm font-semibold">
              <HelpLabel
                label={`${group.label} (${group.findings.length})`}
                helpText={group.help}
              />
            </h3>
            {group.findings.map((f) => (
              <FixRow
                key={f.code}
                finding={f}
                done={done.has(f.code)}
                onDone={(checked) => toggle(f.code, checked)}
              />
            ))}
          </section>
        ))
      )}
      {blocked.length ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            <HelpLabel
              label={`${STATUS_LABELS.BLOCKED.label} (${blocked.length})`}
              helpText={STATUS_LABELS.BLOCKED.help}
            />
          </h3>
          <ul className="space-y-1 text-sm">
            {blocked.map((item) => (
              <li key={item.itemId}>
                <span className="font-mono text-xs text-muted-foreground">
                  {item.itemId}
                </span>{" "}
                {item.note ?? "No reason recorded."}
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
        value={
          report.score ? `${report.score.grade} · ${report.score.final}` : "—"
        }
      />
      {HANDBOOK_CATEGORIES.map((c) => (
        <ScoreTile
          key={c}
          label={c}
          value={String(report.categoryScores?.[c] ?? "—")}
        />
      ))}
    </div>
  );
}

function ScoreTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function FixRow({
  finding: f,
  done,
  onDone,
}: {
  finding: Finding;
  done: boolean;
  onDone: (checked: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <Checkbox
          className="mt-1"
          checked={done}
          onCheckedChange={(checked) => onDone(checked)}
          aria-label={`Mark "${f.title}" done`}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1">
            {(f.categories ?? []).map((c) => (
              <Badge key={c} variant="outline">
                {c}
              </Badge>
            ))}
            {f.source === "llm" ? (
              <Badge variant="secondary" title={AI_JUDGED.help}>
                {AI_JUDGED.label}
              </Badge>
            ) : null}
          </div>
          <div
            className={
              done ? "text-muted-foreground line-through" : "font-medium"
            }
          >
            {f.title}
          </div>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {f.urls.length === 1 ? "1 page" : `${f.urls.length} pages`}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Show"}
        </Button>
      </div>
      {open ? <FixDetail finding={f} /> : null}
    </div>
  );
}

function FixDetail({ finding: f }: { finding: Finding }) {
  const [allPages, setAllPages] = useState(false);
  const pages = allPages ? f.urls : f.urls.slice(0, PAGE_PREVIEW);
  return (
    <div className="mt-3 space-y-3 pl-7 text-sm">
      <div>
        <div className="font-medium">Why it matters</div>
        <p className="whitespace-pre-line text-muted-foreground">{f.detail}</p>
      </div>
      <div>
        <div className="font-medium">How to fix</div>
        <p className="whitespace-pre-line">{f.fix}</p>
        {f.limitedReason ? (
          <p className="text-muted-foreground">
            {STATUS_LABELS.LIMITED.label}: {f.limitedReason}
          </p>
        ) : null}
      </div>
      {f.urls.length ? (
        <div>
          <div className="font-medium">Pages</div>
          <ul className="space-y-0.5">
            {pages.map((url) => (
              <li key={url} className="truncate">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
          {f.urls.length > PAGE_PREVIEW && !allPages ? (
            <Button size="sm" variant="link" onClick={() => setAllPages(true)}>
              Show all {f.urls.length}
            </Button>
          ) : null}
        </div>
      ) : null}
      <details>
        <summary className="cursor-pointer text-muted-foreground">
          Details
        </summary>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div>
            <span className="font-mono">{f.code}</span> ·{" "}
            {SEVERITY_LABELS[f.severity].label} ({f.severity}) · effort{" "}
            {f.effort} · items{" "}
            <span className="font-mono">{f.itemIds.join(", ")}</span>
          </div>
          {f.evidence.map((e, i) => (
            <div key={`${e.url}-${i}`}>
              {e.kind}:{" "}
              <a
                href={e.url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {e.url}
              </a>
              {e.excerpt ? ` — ${e.excerpt}` : null}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
