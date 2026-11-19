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
  COPY_QUALITY_TOP,
  copyThresholds,
  type CopyQuality,
} from "@/server/features/handbook/contracts/scaled-copy";

/** Copy quality block (SCALED-COPY §4.4): label line, site medians, top pages. Not scored. */
export function CopyQualityPanel({ section }: { section: CopyQuality }) {
  const thresholds = copyThresholds(section);
  const measured = section.pages.flatMap((p) => (p.measured ? [p] : []));
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{section.label}</p>
      <p className="text-sm">
        {measured.length}/{section.pages.length} pages measured.
      </p>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead>Site median</TableHead>
              <TableHead>Threshold</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {section.medians.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.id}</TableCell>
                <TableCell>{m.value ?? "n/a"}</TableCell>
                <TableCell>{thresholds.get(m.id) ?? "number only"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>URL</TableHead>
              <TableHead>Prose words</TableHead>
              <TableHead>Over</TableHead>
              <TableHead>Metrics over</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {measured.slice(0, COPY_QUALITY_TOP).map((p) => (
              <TableRow key={p.url}>
                <TableCell className="max-w-md truncate">{p.url}</TableCell>
                <TableCell>{p.proseWords}</TableCell>
                <TableCell>{p.overCount}</TableCell>
                <TableCell>
                  {p.metrics
                    .filter((m) => m.over)
                    .map((m) => m.id)
                    .join(", ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
    </div>
  );
}
