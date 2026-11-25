import { sort } from "remeda";
import { noFindingsText } from "@/server/features/handbook/contracts/grade-view";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryState } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/client/components/ui/tabs";
import { ITEM_STATUSES } from "@/server/features/handbook/contracts/status";
import type { ReportJson } from "@/server/features/handbook/contracts/exports";
import { CopyQualityPanel } from "./CopyQualityPanel";
import { ScaledContentPanel } from "./ScaledContentPanel";
import { UnreadPagesTable } from "./UnreadPagesTable";
import { EvidenceViewer } from "./EvidenceViewer";
import { FindingsTable } from "./FindingsTable";
import { FixList } from "./FixList";
import { RunActions } from "./RunActions";
import { RunProgress } from "./RunProgress";
import { ScoreCard } from "./ScoreCard";
import { newerCompletedRun } from "./fixList";
import { handbookRunQuery, handbookRunsQuery } from "./queries";
import { HelpLabel } from "@/client/components/HelpLabel";
import { MODE_LABEL, STATUS_LABELS, TIER_LABEL } from "./labels";

/** Run page line for a run the reconciler marked interrupted (ADR-027). */
function interruptedNote(
  rerun: { newAuditId: string; at: string } | { blockedBy: string } | null,
) {
  if (!rerun) return "Interrupted";
  if ("blockedBy" in rerun)
    return `Interrupted — not re-run: ${rerun.blockedBy}`;
  return `Interrupted — re-run started automatically ${new Date(rerun.at).toLocaleString()}`;
}

/**
 * Plain-words reason for a failed run (B18 WO-B18-013); the stored error
 * code follows for support.
 */
function failedNote(errorCode: string | null) {
  const code = errorCode ?? "unknown";
  if (/timed out|WorkflowTimeoutError/i.test(code) && /queue/i.test(code))
    return "Check failed: it waited too long for another check to finish.";
  if (/timed out|WorkflowTimeoutError/i.test(code))
    return `Check failed: one step ran past its 30-minute limit and was stopped. No grade was given. (${code})`;
  return `Check failed before it finished. No grade was given. (${code})`;
}

/** One handbook run (ADR-010): grade, findings and checklist item statuses. */
export function HandbookRunPage({
  projectId,
  runId,
}: {
  projectId: string;
  runId: string;
}) {
  const runQuery = useQuery(handbookRunQuery(projectId, runId));
  // For the "A newer check exists" link on a not-final grade (WO-B16-003).
  const runsQuery = useQuery(handbookRunsQuery(projectId));
  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <QueryState query={runQuery} errorFallback="Failed to load the run">
          {(detail) =>
            detail ? (
              <>
                <PageHeader
                  title={`Site check · ${detail.run.origin}`}
                  description={`${new Date(detail.run.startedAt).toLocaleString()} · ${detail.run.status}`}
                  actions={
                    detail.run.status === "completed" ? (
                      <RunActions projectId={projectId} runId={runId} />
                    ) : null
                  }
                />
                {detail.run.errorCode === "interrupted" ? (
                  <p className="text-sm text-muted-foreground">
                    {interruptedNote(detail.rerun)}
                  </p>
                ) : detail.run.status === "failed" ? (
                  <p role="alert" className="text-sm text-destructive">
                    {failedNote(detail.run.errorCode)}
                  </p>
                ) : null}
                {detail.run.status === "queued" ||
                detail.run.status === "running" ? (
                  <RunProgress projectId={projectId} runId={runId} />
                ) : null}
                <Tabs
                  // Re-mount when a live run completes so it opens on the Fix list.
                  key={detail.run.status}
                  defaultValue={
                    detail.run.status === "completed" ? "fix" : "details"
                  }
                >
                  <TabsList>
                    {detail.run.status === "completed" ? (
                      <TabsTrigger value="fix">Fix list</TabsTrigger>
                    ) : null}
                    <TabsTrigger value="details">Details</TabsTrigger>
                  </TabsList>
                  {detail.run.status === "completed" ? (
                    <TabsContent value="fix">
                      <FixList
                        projectId={projectId}
                        runId={runId}
                        report={detail.report}
                        notes={detail.capNotes}
                        runDate={detail.run.startedAt}
                        newerRunId={
                          runsQuery.data
                            ? newerCompletedRun(runsQuery.data, detail.run)
                            : null
                        }
                      />
                    </TabsContent>
                  ) : null}
                  <TabsContent value="details" className="space-y-4">
                    {detail.run.status === "completed" ? (
                      <ScoreCard report={detail.report} />
                    ) : null}
                    {detail.capNotes.map((note) => (
                      <p key={note} className="text-sm text-muted-foreground">
                        {note}
                      </p>
                    ))}
                    {detail.report.run.coverage?.unread ? (
                      <UnreadPagesTable
                        unread={detail.report.run.coverage.unread}
                        capped={detail.report.run.coverage.capped}
                      />
                    ) : null}
                    <Tabs defaultValue="findings">
                      <TabsList>
                        <TabsTrigger value="findings">
                          Findings (
                          {detail.report.findings.length +
                            (detail.report.additionalFindings?.length ?? 0)}
                          )
                        </TabsTrigger>
                        <TabsTrigger value="items">
                          Checklist ({detail.report.items.length})
                        </TabsTrigger>
                        <TabsTrigger value="evidence">Evidence</TabsTrigger>
                        {detail.report.scaledContent ? (
                          <TabsTrigger value="scaled">
                            Scaled content
                          </TabsTrigger>
                        ) : null}
                        {detail.report.copyQuality ? (
                          <TabsTrigger value="copy">Copy quality</TabsTrigger>
                        ) : null}
                      </TabsList>
                      <TabsContent value="findings">
                        <FindingsTable
                          findings={detail.report.findings}
                          emptyText={
                            detail.run.status === "completed"
                              ? noFindingsText(detail.report)
                              : "This check has not finished, so no findings are recorded."
                          }
                        />
                        {detail.report.additionalFindings?.length ? (
                          <div className="mt-6 space-y-2">
                            <h3 className="text-sm font-medium">
                              Additional findings (not scored)
                            </h3>
                            <FindingsTable
                              findings={detail.report.additionalFindings}
                            />
                          </div>
                        ) : null}
                      </TabsContent>
                      <TabsContent value="items">
                        <p className="mb-2 text-xs text-muted-foreground">
                          {MODE_LABEL}: {detail.run.mode} · {TIER_LABEL}:{" "}
                          {detail.run.tier ?? "?"}
                        </p>
                        <ItemsTable items={detail.report.items} />
                      </TabsContent>
                      <TabsContent value="evidence">
                        <EvidenceViewer projectId={projectId} runId={runId} />
                      </TabsContent>
                      {detail.report.scaledContent ? (
                        <TabsContent value="scaled">
                          <ScaledContentPanel
                            summary={detail.report.scaledContent}
                          />
                        </TabsContent>
                      ) : null}
                      {detail.report.copyQuality ? (
                        <TabsContent value="copy">
                          <CopyQualityPanel
                            section={detail.report.copyQuality}
                          />
                        </TabsContent>
                      ) : null}
                    </Tabs>
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <PageHeader
                title="Run not found"
                description="This handbook run does not exist in this project."
              />
            )
          }
        </QueryState>
      </div>
    </div>
  );
}

type Item = ReportJson["items"][number];

const ALL = "all";
/** Registry ids are `<phase>-<nn>` (e.g. P1-04). */
const phaseOf = (itemId: string) => itemId.split("-")[0];

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const items = [{ value: ALL, label: `All ${label}` }, ...options];
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => onChange(v ?? ALL)}
    >
      <SelectTrigger aria-label={label} className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Checklist item statuses, filterable by phase and status. */
function ItemsTable({ items }: { items: Item[] }) {
  const [phase, setPhase] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const phases = sort(
    [...new Set(items.map((i) => phaseOf(i.itemId)))],
    (a, b) => a.localeCompare(b),
  );
  const visible = items.filter(
    (i) =>
      (phase === ALL || phaseOf(i.itemId) === phase) &&
      (status === ALL || i.status === status),
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <FilterSelect
          label="phases"
          value={phase}
          options={phases.map((p) => ({ value: p, label: p }))}
          onChange={setPhase}
        />
        <FilterSelect
          label="statuses"
          value={status}
          options={ITEM_STATUSES.map((s) => ({
            value: s,
            label: STATUS_LABELS[s].label,
          }))}
          onChange={setStatus}
        />
      </div>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((item) => (
              <TableRow key={item.itemId}>
                <TableCell className="font-mono text-xs">
                  {item.itemId}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={item.status === "OPEN" ? "destructive" : "outline"}
                  >
                    <HelpLabel
                      label={STATUS_LABELS[item.status].label}
                      helpText={STATUS_LABELS[item.status].help}
                    />
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {item.note ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  );
}
