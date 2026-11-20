import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/client/components/ui/alert";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
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
import { findingAnchor } from "./FindingsTable";

type Score = NonNullable<ReportJson["score"]>;

/**
 * Grade card + phase table (WO-B4-010). Provisional follows the exports
 * (WO-B4-006): the runner notes "render unavailable: <reason>" on BLOCKED
 * items; the reason (e.g. the in-app sidecar probe, WO-B13-007) is shown.
 */
export function ScoreCard({ report }: { report: ReportJson }) {
  const { score } = report;
  if (!score) return null;
  const renderNote = report.items.find((i) =>
    i.note?.startsWith("render unavailable"),
  )?.note;
  const reason =
    renderNote?.replace(/^render unavailable:?\s*/, "").replace(/\.$/, "") ||
    "render unavailable";
  return (
    <div className="space-y-3">
      {renderNote ? (
        <Alert variant="warning">
          <AlertTitle>Grade provisional</AlertTitle>
          <AlertDescription>
            Browser checks skipped: {reason}. Content that only appears with
            JavaScript and must-fix display problems are not counted yet.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 md:grid-cols-[16rem_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Grade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold">{score.grade}</span>
              <span className="text-lg">{score.final} / 100</span>
            </div>
            {score.capReason ? (
              <p
                className="text-sm text-muted-foreground"
                title={score.capReason}
              >
                Capped from {score.uncapped}: a must-fix problem limits the
                grade.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              handbook v{report.handbookVersion} · compare only within the same
              version
            </p>
          </CardContent>
        </Card>
        <PhaseTable phases={score.phases} />
      </div>
    </div>
  );
}

function PhaseTable({ phases }: { phases: Score["phases"] }) {
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Phase</TableHead>
            <TableHead>Weight</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Driver</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {phases.map((p) => (
            <TableRow key={p.phase}>
              <TableCell className="font-mono text-xs">{p.phase}</TableCell>
              <TableCell>{p.weight}</TableCell>
              <TableCell>{p.score ?? "—"}</TableCell>
              <TableCell className="text-sm">
                <DriverLinks driver={p.driver} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}

/** Drivers read "F03 Title; F07 Title"; each code links to its finding row. */
function DriverLinks({ driver }: { driver: string | null }) {
  if (!driver) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="space-x-2">
      {driver.split("; ").map((part) => {
        const [code, ...title] = part.split(" ");
        return (
          <span key={code}>
            <a
              href={`#${findingAnchor(code)}`}
              className="font-mono text-xs underline"
            >
              {code}
            </a>{" "}
            <span className="text-muted-foreground">{title.join(" ")}</span>
          </span>
        );
      })}
    </span>
  );
}
