import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryState } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { SimpleTable } from "@/client/features/bing/BingParts";
import {
  getCcBaseline,
  setCcEnabled,
} from "@/server/features/backlinks/providers/commoncrawl/functions";

// Common Crawl backlink baseline (ADR-016 §4). Domain-level only; imported
// monthly by the local CLI. DATA mode only (never in REVIEW audits, EP-7).

const ccQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["commoncrawl", projectId],
    queryFn: () => getCcBaseline({ data: { projectId } }),
  });

type Baseline = Awaited<ReturnType<typeof getCcBaseline>>;

export function CommonCrawlPage({ projectId }: { projectId: string }) {
  const query = useQuery(ccQuery(projectId));
  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title="Backlinks (Common Crawl)"
          description="Who links to the project's domain, from the free Common Crawl domain graph. Domain level only: no URLs, anchors or nofollow. Imported monthly; each release covers a 3-month crawl window."
        />
        <QueryState
          query={query}
          errorFallback="Failed to load the Common Crawl baseline"
        >
          {(baseline) => (
            <CommonCrawlCard projectId={projectId} baseline={baseline} />
          )}
        </QueryState>
      </div>
    </div>
  );
}

function CommonCrawlCard({
  projectId,
  baseline,
}: {
  projectId: string;
  baseline: Baseline;
}) {
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: (enabled: boolean) =>
      setCcEnabled({ data: { projectId, enabled } }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["commoncrawl", projectId] }),
    onError: () => toast.error("Could not update Common Crawl."),
  });
  const delta =
    baseline.previousReferringDomains === null
      ? null
      : baseline.referringDomains - baseline.previousReferringDomains;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Common Crawl baseline
            <Badge variant={baseline.enabled ? "default" : "outline"}>
              {baseline.enabled ? "On" : "Off"}
            </Badge>
          </CardTitle>
          <CardDescription>
            {baseline.domain || "No project domain set."}
            {baseline.releaseId
              ? ` · release ${baseline.releaseWindow}`
              : " · not imported yet"}
            {baseline.previousReleaseWindow
              ? ` · compared with ${baseline.previousReleaseWindow}`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Referring domains" value={baseline.referringDomains} />
            <Stat
              label="Change vs previous"
              value={delta === null ? "—" : delta > 0 ? `+${delta}` : delta}
            />
            <Stat label="New linking domains" value={baseline.newDomains} />
            <Stat label="Lost linking domains" value={baseline.lostDomains} />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!baseline.domain || toggle.isPending}
            onClick={() => toggle.mutate(!baseline.enabled)}
          >
            {baseline.enabled
              ? "Turn off monthly import"
              : "Turn on monthly import"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Competitors from the project's competitor list are imported with it.
            Up to 5,000 linking domains per domain, largest first.
          </p>
        </CardContent>
      </Card>
      <SimpleTable
        title="Top linking domains"
        columns={["Domain", "Hosts"]}
        rows={baseline.topLinkingDomains.map((d) => [d.domain, d.numHosts])}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <SimpleTable
          title="New since previous release"
          columns={["Domain", "Hosts"]}
          rows={baseline.newLinkingDomains.map((d) => [d.domain, d.numHosts])}
        />
        <SimpleTable
          title="Lost since previous release"
          columns={["Domain", "Hosts"]}
          rows={baseline.lostLinkingDomains.map((d) => [d.domain, d.numHosts])}
        />
      </div>
      <SimpleTable
        title="Competitor gap (links to a competitor, not to you)"
        columns={["Domain", "Competitors", "Hosts"]}
        rows={baseline.competitorGap.map((d) => [
          d.domain,
          d.competitors.join(", "),
          d.numHosts,
        ])}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
