import { useQuery } from "@tanstack/react-query";
import { QueryState } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import type { HandbookRunProgress } from "@/server/features/handbook/services/HandbookService";
import { handbookRunProgressQuery } from "./queries";
import { stageLabel } from "./labels";

/** Live stage, pages, escalations and LLM spend of a queued or running run (FULL-READ §7.5). */
export function RunProgress({
  projectId,
  runId,
}: {
  projectId: string;
  runId: string;
}) {
  const query = useQuery(handbookRunProgressQuery(projectId, runId));
  return (
    <QueryState query={query} errorFallback="Failed to load run progress">
      {(progress) => <ProgressCard progress={progress} />}
    </QueryState>
  );
}

function ProgressCard({ progress }: { progress: HandbookRunProgress }) {
  const pages =
    progress.pagesTotal === null
      ? "—"
      : `${progress.pagesDone ?? 0} / ${progress.pagesTotal}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {progress.status === "queued"
            ? queuedText(progress.queuedBehind)
            : `Running · ${progress.currentStage ? stageLabel(progress.currentStage) : "starting"}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <Stat label="Pages (current stage)" value={pages} />
          <Stat label="Extra checks" value={String(progress.escalations)} />
          <Stat
            label="AI review cost"
            value={`$${progress.llmCostUsd.toFixed(2)}`}
          />
        </dl>
        {progress.stages.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Step</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Parts</TableHead>
                <TableHead>Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {progress.stages.map((s) => (
                <TableRow key={s.stage}>
                  <TableCell>{stageLabel(s.stage)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        s.status === "failed" ? "destructive" : "outline"
                      }
                      title={s.error ?? undefined}
                    >
                      {s.status}
                    </Badge>
                    {s.status === "skipped" && s.error ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {s.error}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {s.batchesDone} / {s.batches}
                  </TableCell>
                  <TableCell>{s.itemsDone}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}

function queuedText(behind: HandbookRunProgress["queuedBehind"]) {
  if (behind?.sameProject && behind.runId)
    return `Queued behind run ${behind.runId.slice(0, 8)}`;
  return "Queued behind another run";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
