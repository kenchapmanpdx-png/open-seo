import { useForm } from "@tanstack/react-form";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
import { Input } from "@/client/components/ui/input";
import { SimpleTable } from "@/client/features/bing/BingParts";
import {
  BYOK_PROVIDERS,
  type ByokProviderId,
} from "@/server/features/ai-visibility/providers/byok/contracts";
import {
  getByokPage,
  runByokNow,
  setByokApiKey,
  setByokProvider,
  setByokSchedule,
} from "@/server/features/ai-visibility/providers/byok/functions";

// AI visibility with the organization's own provider keys (ADR-015): keys,
// provider/model per tracker, schedule, DataForSEO-vs-BYOK comparison and
// query fan-out. Spend goes to the user's own accounts, not OpenSEO credits.

const LABEL: Record<ByokProviderId, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  perplexity: "Perplexity",
};

const byokQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["byok", projectId],
    queryFn: () => getByokPage({ data: { projectId } }),
  });

type Page = Extract<Awaited<ReturnType<typeof getByokPage>>, { tracker: true }>;

function useRefresh(projectId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["byok", projectId] });
}

export function ByokPage({ projectId }: { projectId: string }) {
  const query = useQuery(byokQuery(projectId));
  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title="AI visibility with your keys"
          description="Run your tracked prompts directly against OpenAI, Anthropic, Gemini and Perplexity with your own API keys, then compare with the DataForSEO results. Usage is billed by each provider to your account."
        />
        <QueryState query={query} errorFallback="Failed to load BYOK data">
          {(page) =>
            page.tracker ? (
              <>
                <ProvidersCard projectId={projectId} page={page} />
                <ScheduleCard projectId={projectId} page={page} />
                <ComparisonCard page={page} />
                <FanoutCard projectId={projectId} page={page} />
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Set up AI visibility tracking for this project first; BYOK runs
                use the same prompts.
              </p>
            )
          }
        </QueryState>
      </div>
    </div>
  );
}

function ProvidersCard({ projectId, page }: { projectId: string; page: Page }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Providers and keys</CardTitle>
        <CardDescription>
          Keys are stored encrypted for your organization and never shown. A
          provider runs when it has a key and a model.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {BYOK_PROVIDERS.map((provider) => (
          <ProviderRow
            key={provider}
            projectId={projectId}
            provider={provider}
            page={page}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function ProviderRow({
  projectId,
  provider,
  page,
}: {
  projectId: string;
  provider: ByokProviderId;
  page: Page;
}) {
  const refresh = useRefresh(projectId);
  const onError = (error: Error) => toast.error(error.message);
  const saveKey = useMutation({
    mutationFn: (key: string | null) =>
      setByokApiKey({ data: { projectId, provider, key } }),
    onSuccess: async () => {
      keyForm.reset();
      await refresh();
    },
    onError,
  });
  const saveModel = useMutation({
    mutationFn: (model: string | null) =>
      setByokProvider({ data: { projectId, provider, model } }),
    onSuccess: refresh,
    onError,
  });
  const current = page.providers.find((p) => p.provider === provider);
  const keyForm = useForm({
    defaultValues: { key: "" },
    onSubmit: ({ value }) => saveKey.mutate(value.key),
  });
  const modelForm = useForm({
    defaultValues: { model: current?.model ?? page.defaultModels[provider] },
    onSubmit: ({ value }) => saveModel.mutate(value.model),
  });
  const status = page.keys[provider];
  return (
    <div className="flex flex-wrap items-center gap-3 border-b pb-4 last:border-0">
      <div className="w-28 font-medium">{LABEL[provider]}</div>
      <Badge variant={status.configured ? "secondary" : "outline"}>
        {status.configured
          ? status.source === "env"
            ? "key (server env)"
            : "key saved"
          : "no key"}
      </Badge>
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void keyForm.handleSubmit();
        }}
      >
        <keyForm.Field name="key">
          {(field) => (
            <Input
              aria-label={`${LABEL[provider]} API key`}
              className="w-56"
              type="password"
              autoComplete="off"
              placeholder={status.configured ? "Replace key" : "API key"}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          )}
        </keyForm.Field>
        <Button type="submit" size="sm" disabled={saveKey.isPending}>
          Save key
        </Button>
        {status.source === "org" ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => saveKey.mutate(null)}
          >
            Remove
          </Button>
        ) : null}
      </form>
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void modelForm.handleSubmit();
        }}
      >
        <modelForm.Field name="model">
          {(field) => (
            <Input
              aria-label={`${LABEL[provider]} model`}
              className="w-48"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          )}
        </modelForm.Field>
        <Button type="submit" size="sm" variant="outline">
          {current ? "Update model" : "Enable"}
        </Button>
        {current ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => saveModel.mutate(null)}
          >
            Disable
          </Button>
        ) : null}
      </form>
    </div>
  );
}

function ScheduleCard({ projectId, page }: { projectId: string; page: Page }) {
  const refresh = useRefresh(projectId);
  const run = useMutation({
    mutationFn: () => runByokNow({ data: { projectId } }),
    onSuccess: async (summary) => {
      toast.success(
        summary
          ? `Run finished: ${summary.completed} answers, ${summary.failed} failed, $${(summary.costUsdMicros / 1e6).toFixed(3)}.`
          : "Nothing to run.",
      );
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const schedule = useMutation({
    mutationFn: (intervalDays: number | null) =>
      setByokSchedule({ data: { projectId, intervalDays } }),
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });
  const form = useForm({
    defaultValues: { days: page.schedule?.intervalDays ?? 7 },
    onSubmit: ({ value }) => schedule.mutate(value.days),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Runs</CardTitle>
        <CardDescription>
          {page.schedule
            ? `Every ${page.schedule.intervalDays} days · next ${page.schedule.nextRunAt.slice(0, 16).replace("T", " ")} UTC.`
            : "No schedule; run manually."}{" "}
          Each run is capped by the BYOK run budget (default $2).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => run.mutate()}
          disabled={run.isPending || page.providers.length === 0}
        >
          {run.isPending ? "Running…" : "Run with my keys"}
        </Button>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="days">
            {(field) => (
              <Input
                aria-label="Schedule interval in days"
                className="w-20"
                type="number"
                min={1}
                max={90}
                value={field.state.value}
                onChange={(e) => field.handleChange(Number(e.target.value))}
              />
            )}
          </form.Field>
          <Button type="submit" size="sm" variant="outline">
            Schedule (days)
          </Button>
          {page.schedule ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => schedule.mutate(null)}
            >
              Stop schedule
            </Button>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

const yesNo = (value: boolean | undefined) =>
  value === undefined ? "—" : value ? "yes" : "no";

function ComparisonCard({ page }: { page: Page }) {
  const prompts = new Map(page.prompts.map((p) => [p.id, p.text]));
  const compare = page.comparison;
  return (
    <SimpleTable
      title={
        compare
          ? `Comparison: BYOK ${compare.byokRun.startedAt.slice(0, 10)} vs DataForSEO ${compare.upstreamRun?.createdAt.slice(0, 10) ?? "—"}`
          : "Comparison (no completed BYOK run yet)"
      }
      columns={[
        "Prompt",
        "Provider",
        "DFS mentioned",
        "BYOK mentioned",
        "DFS cited",
        "BYOK cited",
        "BYOK sources",
        "Fan-out (BYOK; DFS n/a)",
      ]}
      rows={(compare?.rows ?? []).map((row) => [
        prompts.get(row.promptId) ?? row.promptId,
        `${LABEL[row.provider]} ↔ ${row.engine}`,
        yesNo(row.dataforseo?.mentioned),
        row.byok ? yesNo(row.byok.mentioned) : row.byokStatus,
        yesNo(row.dataforseo?.cited),
        yesNo(row.byok?.cited),
        row.byok?.sources ?? "—",
        row.byok?.fanoutQueries ?? "—",
      ])}
    />
  );
}

function FanoutCard({ projectId, page }: { projectId: string; page: Page }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top fan-out queries</CardTitle>
        <CardDescription>
          Searches the models ran that differ from your prompt text, across BYOK
          runs. Perplexity does not expose its searches; DataForSEO fan-out is
          not stored upstream.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {page.fanout.top.length === 0 ? (
          <p className="text-muted-foreground text-sm">No fan-out yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {page.fanout.top.map((q) => (
              <li key={q.query} className="flex justify-between gap-4">
                <Link
                  className="underline-offset-2 hover:underline"
                  to="/p/$projectId/keywords"
                  params={{ projectId }}
                  search={{ q: q.query }}
                >
                  {q.query}
                </Link>
                <span className="text-muted-foreground">{q.count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
