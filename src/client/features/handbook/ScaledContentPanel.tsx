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
  scaledContentRows,
  type ScaledContent,
} from "@/server/features/handbook/contracts/scaled-copy";

/** Scaled-content summary (SCALED-COPY §3.5): counts only, not scored. */
export function ScaledContentPanel({ summary }: { summary: ScaledContent }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Scaled content — not scored. Counts from pages this run already read.
      </p>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Measure</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scaledContentRows(summary).map((r) => (
              <TableRow key={r.label}>
                <TableCell>{r.label}</TableCell>
                <TableCell>{r.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  );
}
