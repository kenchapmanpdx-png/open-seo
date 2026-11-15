import { sort } from "remeda";
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
import type { getHandbookRun } from "@/server/features/handbook/functions";
import { EvidenceViewer } from "./EvidenceViewer";
import { FindingsTable } from "./FindingsTable";
import { RunActions } from "./RunActions";
import { handbookRunQuery } from "./queries";

/** One handbook run (ADR-010): findings and checklist item statuses. */
export function HandbookRunPage({
  projectId,
  runId,
}: {
  projectId: string;
  runId: string;
}) {
  const runQuery = useQuery(handbookRunQuery(projectId, runId));
  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <QueryState query={runQuery} errorFallback="Failed to load the run">
          {(detail) =>
            detail ? (
              <>
                <PageHeader
                  title={`Handbook run · ${detail.run.origin}`}
                  description={`${detail.run.mode} · tier ${detail.run.tier ?? "?"} · ${detail.run.status}`}
                  actions={
                    detail.run.status === "completed" ? (
                      <RunActions projectId={projectId} runId={runId} />
                    ) : null
                  }
                />
                <Tabs defaultValue="findings">
                  <TabsList>
                    <TabsTrigger value="findings">
                      Findings ({detail.findings.length})
                    </TabsTrigger>
                    <TabsTrigger value="items">
                      Checklist ({detail.items.length})
                    </TabsTrigger>
                    <TabsTrigger value="evidence">Evidence</TabsTrigger>
                  </TabsList>
                  <TabsContent value="findings">
                    <FindingsTable findings={detail.findings} />
                  </TabsContent>
                  <TabsContent value="items">
                    <ItemsTable items={detail.items} />
                  </TabsContent>
                  <TabsContent value="evidence">
                    <EvidenceViewer projectId={projectId} runId={runId} />
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

type Item = NonNullable<
  Awaited<ReturnType<typeof getHandbookRun>>
>["items"][number];

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
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  const items = [
    { value: ALL, label: `All ${label}` },
    ...options.map((o) => ({ value: o, label: o })),
  ];
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
          options={phases}
          onChange={setPhase}
        />
        <FilterSelect
          label="statuses"
          value={status}
          options={ITEM_STATUSES}
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
                    {item.status}
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
