import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/client/components/ui/button";
import {
  getOutcomeFollowupsMd,
  recordOutcomeFixBatch,
} from "@/server/features/agency/functions";
import {
  getHandbookRunExports,
  publishHandbookReport,
} from "@/server/features/handbook/functions";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Run page actions (WO-B4-009): client report into Reports, file downloads. */
export function RunActions({
  projectId,
  runId,
}: {
  projectId: string;
  runId: string;
}) {
  const publish = useMutation({
    mutationFn: () => publishHandbookReport({ data: { projectId, runId } }),
  });
  const exports = useMutation({
    mutationFn: (file: "status" | "report") =>
      getHandbookRunExports({ data: { projectId, runId } }).then((x) =>
        file === "status"
          ? download("seo-geo-status.md", x.statusMd, "text/markdown")
          : download("report.json", x.reportJson, "application/json"),
      ),
  });
  // Outcome record (ADR-017 §3): all findings of this run marked fixed now;
  // checks run at +4 and +12 weeks. The server rejects REVIEW runs.
  const fixBatch = useMutation({
    mutationFn: () =>
      recordOutcomeFixBatch({ data: { projectId, runId, findingCodes: [] } }),
  });
  const followups = useMutation({
    mutationFn: () =>
      getOutcomeFollowupsMd({ data: { projectId } }).then((md) =>
        download("seo-followups.md", md, "text/markdown"),
      ),
  });
  const error =
    publish.error ?? exports.error ?? fixBatch.error ?? followups.error;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {publish.data ? (
        <Button
          variant="outline"
          render={
            <Link
              to="/p/$projectId/reports/$reportId"
              params={{ projectId, reportId: publish.data.reportId }}
            />
          }
        >
          Open client report
        </Button>
      ) : (
        <Button onClick={() => publish.mutate()} disabled={publish.isPending}>
          {publish.isPending ? "Saving…" : "Save as client report"}
        </Button>
      )}
      <Button
        variant="outline"
        onClick={() => exports.mutate("status")}
        disabled={exports.isPending}
      >
        Download status.md
      </Button>
      <Button
        variant="outline"
        onClick={() => exports.mutate("report")}
        disabled={exports.isPending}
      >
        Download report.json
      </Button>
      <Button
        variant="outline"
        onClick={() => fixBatch.mutate()}
        disabled={fixBatch.isPending || fixBatch.isSuccess}
        title="Mark this run's findings fixed; re-check them at +4 and +12 weeks"
      >
        {fixBatch.isSuccess ? "Fix batch recorded" : "Record fix batch"}
      </Button>
      <Button
        variant="outline"
        onClick={() => followups.mutate()}
        disabled={followups.isPending}
      >
        Download seo-followups.md
      </Button>
      {error ? (
        <span className="text-sm text-destructive">{error.message}</span>
      ) : null}
    </div>
  );
}
