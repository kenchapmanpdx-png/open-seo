import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryState } from "@/client/components/QueryState";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/client/components/ui/tabs";
import { FindingsTable } from "./FindingsTable";
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
                />
                <Tabs defaultValue="findings">
                  <TabsList>
                    <TabsTrigger value="findings">
                      Findings ({detail.findings.length})
                    </TabsTrigger>
                    <TabsTrigger value="items">
                      Checklist ({detail.items.length})
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="findings">
                    <FindingsTable findings={detail.findings} />
                  </TabsContent>
                  <TabsContent value="items">
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
                          {detail.items.map((item) => (
                            <TableRow key={item.itemId}>
                              <TableCell className="font-mono text-xs">
                                {item.itemId}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    item.status === "OPEN"
                                      ? "destructive"
                                      : "outline"
                                  }
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
