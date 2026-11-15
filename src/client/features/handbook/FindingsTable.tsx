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
import type { ReportJson } from "@/server/features/handbook/contracts/exports";

type Finding = ReportJson["findings"][number];

const SEVERITIES = ["S1", "S2", "S3", "S4"] as const;

/** Row anchor that the phase table's driver codes link to. */
export const findingAnchor = (code: string) => `finding-${code}`;

/** Findings grouped by severity (S1 first), each group by F-code. */
export function FindingsTable({ findings }: { findings: Finding[] }) {
  if (findings.length === 0)
    return (
      <EmptyState
        icon={ListChecks}
        title="No findings"
        description="Every automated check passed or was not applicable."
      />
    );
  return (
    <div className="space-y-4">
      {SEVERITIES.map((severity) => {
        const group = sort(
          findings.filter((f) => f.severity === severity),
          (a, b) => a.code.localeCompare(b.code),
        );
        if (group.length === 0) return null;
        return (
          <section key={severity} className="space-y-2">
            <h3 className="text-sm font-semibold">
              {severity} · {group.length}
            </h3>
            <FindingRows findings={group} />
          </section>
        );
      })}
    </div>
  );
}

function FindingRows({ findings }: { findings: Finding[] }) {
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Finding</TableHead>
            <TableHead>Fix</TableHead>
            <TableHead>Effort</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {findings.map((f) => (
            <TableRow
              key={f.code}
              id={findingAnchor(f.code)}
              className="scroll-mt-4 target:bg-muted"
            >
              <TableCell className="align-top">
                <div className="font-mono text-xs">{f.code}</div>
                <Badge
                  variant={f.severity === "S1" ? "destructive" : "outline"}
                >
                  {f.severity}
                </Badge>
              </TableCell>
              <TableCell className="max-w-[420px] align-top">
                <div className="font-medium">{f.title}</div>
                <div className="flex flex-wrap gap-1 py-1">
                  {f.source === "llm" ? (
                    <Badge variant="secondary">AI-reviewed</Badge>
                  ) : null}
                  {f.fixability === "LIMITED" ? (
                    <Badge variant="outline" title={f.limitedReason ?? ""}>
                      platform limit
                    </Badge>
                  ) : null}
                </div>
                <div className="whitespace-pre-line text-xs text-muted-foreground">
                  {f.detail}
                </div>
              </TableCell>
              <TableCell className="max-w-[320px] align-top text-sm">
                {f.fix}
                {f.limitedReason ? (
                  <div className="text-xs text-muted-foreground">
                    {f.limitedReason}
                  </div>
                ) : null}
              </TableCell>
              <TableCell className="align-top">{f.effort}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}
