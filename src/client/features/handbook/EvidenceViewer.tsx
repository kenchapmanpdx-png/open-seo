import { useMutation, useQuery } from "@tanstack/react-query";
import { FileSearch } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/client/components/EmptyState";
import { QueryState } from "@/client/components/QueryState";
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
import { getHandbookEvidence } from "@/server/features/handbook/functions";
import { handbookEvidenceQuery } from "./queries";

/**
 * Evidence excerpts for one run (ADR-003). The full body opens through a
 * short-lived signed storage URL; it never streams through the worker.
 */
export function EvidenceViewer({
  projectId,
  runId,
}: {
  projectId: string;
  runId: string;
}) {
  const evidenceQuery = useQuery(handbookEvidenceQuery(projectId, runId));
  const openBody = useMutation({
    mutationFn: (evidenceId: string) =>
      getHandbookEvidence({ data: { projectId, evidenceId } }),
    onSuccess: (evidence) => {
      if (evidence?.bodyUrl)
        window.open(evidence.bodyUrl, "_blank", "noopener,noreferrer");
      else toast.error("The full body is not available for this evidence.");
    },
    onError: () => toast.error("Failed to open the evidence body"),
  });
  return (
    <QueryState query={evidenceQuery} errorFallback="Failed to load evidence">
      {(rows) =>
        rows.length === 0 ? (
          <EmptyState
            icon={FileSearch}
            title="No evidence"
            description="This run stored no evidence."
          />
        ) : (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Excerpt</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="align-top font-mono text-xs">
                      {e.itemId}
                    </TableCell>
                    <TableCell className="align-top text-xs">
                      {e.kind}
                    </TableCell>
                    <TableCell className="max-w-[640px] align-top">
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-xs text-primary hover:underline"
                      >
                        {e.url}
                      </a>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">
                        {e.excerpt}
                      </pre>
                    </TableCell>
                    <TableCell className="align-top">
                      {e.storageKey ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={openBody.isPending}
                          onClick={() => openBody.mutate(e.id)}
                        >
                          Full body
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        )
      }
    </QueryState>
  );
}
