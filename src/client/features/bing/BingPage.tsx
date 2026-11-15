import { useForm } from "@tanstack/react-form";
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
import { Field, FieldLabel } from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import {
  bindBingSite,
  deleteBingApiKey,
  getBing,
  importBingAiCsv,
  listBingSites,
  setBingApiKey,
  unbindBingSite,
} from "@/server/features/bing/functions";
import { SimpleTable, TrafficChart } from "./BingParts";

// Bing tab (ADR-014 §4): Webmaster Tools key + site, crawl issues, traffic,
// top queries/pages, and AI Performance (CSV import). DATA mode only.

const bingQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["bing", projectId],
    queryFn: () => getBing({ data: { projectId } }),
  });

type Bing = Awaited<ReturnType<typeof getBing>>;
type BingData = NonNullable<Bing["data"]>;

function useRefresh(projectId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["bing", projectId] });
}

export function BingPage({ projectId }: { projectId: string }) {
  const query = useQuery(bingQuery(projectId));
  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title="Bing"
          description="Bing Webmaster Tools: verification, crawl issues, search traffic, and Copilot citations from the AI Performance export. Synced daily."
        />
        <QueryState query={query} errorFallback="Failed to load Bing data">
          {(bing) => (
            <>
              <KeyCard projectId={projectId} bing={bing} />
              <SiteCard projectId={projectId} bing={bing} />
              {bing.data ? (
                <BingData projectId={projectId} data={bing.data} />
              ) : null}
            </>
          )}
        </QueryState>
      </div>
    </div>
  );
}

function KeyCard({ projectId, bing }: { projectId: string; bing: Bing }) {
  const refresh = useRefresh(projectId);
  const save = useMutation({
    mutationFn: (key: string) => setBingApiKey({ data: { projectId, key } }),
    onSuccess: async () => {
      form.reset();
      toast.success("Bing API key saved.");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: () => deleteBingApiKey({ data: { projectId } }),
    onSuccess: refresh,
  });
  const form = useForm({
    defaultValues: { key: "" },
    onSubmit: ({ value }) => save.mutate(value.key),
  });
  const { configured, source } = bing.keyStatus;
  return (
    <Card>
      <CardHeader>
        <CardTitle>API key</CardTitle>
        <CardDescription>
          {configured
            ? `Configured (${source === "env" ? "server environment" : "this organization"}). The key is never shown.`
            : "Create one in Bing Webmaster Tools → Settings → API access. It is stored encrypted for your organization."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="key">
            {(field) => (
              <Field className="w-80">
                <FieldLabel htmlFor={field.name}>
                  {configured ? "Replace key" : "API key"}
                </FieldLabel>
                <Input
                  id={field.name}
                  type="password"
                  autoComplete="off"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
          <Button type="submit" disabled={save.isPending}>
            Save
          </Button>
          {configured && source === "org" ? (
            <Button
              variant="outline"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Remove key
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

function SiteCard({ projectId, bing }: { projectId: string; bing: Bing }) {
  const refresh = useRefresh(projectId);
  const sites = useMutation({
    mutationFn: () => listBingSites({ data: { projectId } }),
    onError: (error) => toast.error(error.message),
  });
  const bind = useMutation({
    mutationFn: (siteUrl: string) =>
      bindBingSite({ data: { projectId, siteUrl } }),
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });
  const unbind = useMutation({
    mutationFn: (siteId: string) =>
      unbindBingSite({ data: { projectId, siteId } }),
    onSuccess: refresh,
  });
  const { site, summary } = bing;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Site</CardTitle>
        <CardDescription>
          {site
            ? `Last sync ${site.lastSuccessAt ?? "never"}${site.lastError ? ` · last error: ${site.lastError}` : ""}`
            : "Pick the site from your Bing Webmaster Tools account."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {site ? (
          <div className="flex flex-wrap items-center gap-3">
            <code>{site.siteUrl}</code>
            <Badge variant={site.verified ? "secondary" : "outline"}>
              {site.verified ? "verified" : "not verified"}
            </Badge>
            <span className="text-muted-foreground">
              28 days: {summary.clicks28d ?? "—"} clicks ·{" "}
              {summary.impressions28d ?? "—"} impressions ·{" "}
              {summary.blockingCrawlIssues} blocking crawl issues
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={unbind.isPending}
              onClick={() => unbind.mutate(site.id)}
            >
              Unbind
            </Button>
          </div>
        ) : (
          <>
            <Button
              variant="outline"
              disabled={!bing.keyStatus.configured || sites.isPending}
              onClick={() => sites.mutate()}
            >
              Load sites
            </Button>
            {sites.data?.map((candidate) => (
              <div key={candidate.siteUrl} className="flex items-center gap-3">
                <code>{candidate.siteUrl}</code>
                {candidate.verified ? null : (
                  <Badge variant="outline">not verified</Badge>
                )}
                <Button
                  size="sm"
                  disabled={bind.isPending}
                  onClick={() => bind.mutate(candidate.siteUrl)}
                >
                  Bind
                </Button>
              </div>
            ))}
            {sites.data?.length === 0 ? (
              <p className="text-muted-foreground">
                This key sees no sites. Add the site in Bing Webmaster Tools
                first.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BingData({ projectId, data }: { projectId: string; data: BingData }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Search traffic (90 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <TrafficChart traffic={data.traffic} />
        </CardContent>
      </Card>
      <SimpleTable
        title="Crawl issues (blocking first)"
        columns={["URL", "Issue", "HTTP", "First seen"]}
        rows={data.crawlIssues.map((issue) => [
          issue.url,
          `${issue.blocking ? "Blocking · " : ""}${issue.issueType}`,
          issue.httpCode ?? "—",
          issue.firstSeen,
        ])}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <SimpleTable
          title="Top queries (latest 4 weeks)"
          columns={["Query", "Clicks", "Impressions"]}
          rows={data.queries.map((r) => [r.label, r.clicks, r.impressions])}
        />
        <SimpleTable
          title="Top pages (latest 4 weeks)"
          columns={["Page", "Clicks", "Impressions"]}
          rows={data.pages.map((r) => [r.label, r.clicks, r.impressions])}
        />
      </div>
      <AiPerformance projectId={projectId} data={data} />
    </>
  );
}

function AiPerformance({
  projectId,
  data,
}: {
  projectId: string;
  data: BingData;
}) {
  const refresh = useRefresh(projectId);
  const upload = useMutation({
    mutationFn: async (file: File) =>
      importBingAiCsv({
        data: { projectId, fileName: file.name, csv: await file.text() },
      }),
    onSuccess: async (result) => {
      toast.success(
        result.duplicate
          ? "This file was already imported."
          : `Imported ${result.rowsUpserted} rows.`,
      );
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Performance (Copilot citations)</CardTitle>
        <CardDescription>
          Not in the Bing API: export the AI Performance report as CSV in Bing
          Webmaster Tools and upload it here. Last import:{" "}
          {data.lastImport ?? "never"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="file"
          accept=".csv,text/csv"
          className="w-80"
          disabled={upload.isPending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.mutate(file);
            event.target.value = "";
          }}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <SimpleTable
            title="Citations by day"
            columns={["Day", "Citations", "Cited pages"]}
            rows={data.aiDays.map((r) => [
              r.day,
              r.citations,
              r.citedPages ?? "—",
            ])}
          />
          <SimpleTable
            title="Grounding queries"
            columns={["Query", "Citations"]}
            rows={data.grounding.map((r) => [r.query, r.citations])}
          />
        </div>
      </CardContent>
    </Card>
  );
}
