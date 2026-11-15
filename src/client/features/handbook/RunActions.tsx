import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/client/components/ui/button";
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
      {publish.error || exports.error ? (
        <span className="text-sm text-destructive">
          {(publish.error ?? exports.error)?.message}
        </span>
      ) : null}
    </div>
  );
}
