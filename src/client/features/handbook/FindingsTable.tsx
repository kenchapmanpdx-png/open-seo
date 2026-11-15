import { sort } from "remeda";
import { ListChecks } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { Badge } from "@/client/components/ui/badge";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import type { getHandbookRun } from "@/server/features/handbook/functions";

type Detail = NonNullable<Awaited<ReturnType<typeof getHandbookRun>>>;
type Finding = Detail["findings"][number];

const SEVERITY_RANK: Record<Finding["severity"], number> = {
  S1: 1,
  S2: 2,
  S3: 3,
  S4: 4,
};

/** Findings by severity (S1 first), then F-code. */
export function FindingsTable({ findings }: { findings: Finding[] }) {
  if (findings.length === 0)
    return (
      <EmptyState
        icon={ListChecks}
        title="No findings"
        description="Every automated check passed or was not applicable."
      />
    );
  const sorted = sort(
    findings,
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.code.localeCompare(b.code),
  );
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Finding</TableHead>
            <TableHead>Fix</TableHead>
            <TableHead>Effort</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((f) => (
            <TableRow key={f.id}>
              <TableCell className="font-mono text-xs">{f.code}</TableCell>
              <TableCell>
                <Badge
                  variant={f.severity === "S1" ? "destructive" : "outline"}
                >
                  {f.severity}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[420px] align-top">
                <div className="font-medium">{f.title}</div>
                <div className="whitespace-pre-line text-xs text-muted-foreground">
                  {f.detail}
                </div>
              </TableCell>
              <TableCell className="max-w-[320px] align-top text-sm">
                {f.fix}
                <div className="text-xs text-muted-foreground">
                  {f.fixability}
                </div>
              </TableCell>
              <TableCell>{f.effort}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}
