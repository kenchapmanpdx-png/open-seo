import { useForm } from "@tanstack/react-form";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/client/components/EmptyState";
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
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import {
  addAiTrafficSite,
  getAiTraffic,
  removeAiTrafficSite,
} from "@/server/features/ai-traffic/functions";

// AI traffic tab (ADR-013 §4): drain-fed AI crawler, agent and referral hits.

const aiTrafficQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["ai-traffic", projectId],
    queryFn: () => getAiTraffic({ data: { projectId } }),
  });

type AiTraffic = Awaited<ReturnType<typeof getAiTraffic>>;
type CountRow = AiTraffic["summary"]["crawlers"][number];

const VERIFICATION_LABEL: Record<string, string> = {
  verified: "verified",
  claimed_unverified: "claimed, unverified",
  unknown_ai_like: "likely fake",
};

export function AiTrafficPage({ projectId }: { projectId: string }) {
  const query = useQuery(aiTrafficQuery(projectId));
  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title="AI traffic"
          description="AI crawlers, AI agents fetching pages for a person, and visits referred by AI answers, from the site's Vercel log drain (last 28 days)."
        />
        <QueryState query={query} errorFallback="Failed to load AI traffic">
          {(data) =>
            data.available ? (
              <>
                <SitesCard projectId={projectId} sites={data.sites} />
                <Summary summary={data.summary} />
              </>
            ) : (
              <EmptyState
                icon={Bot}
                title="Needs a Postgres/Supabase deployment"
                description="The Vercel drain receiver writes to Supabase; this deployment uses SQLite."
              />
            )
          }
        </QueryState>
      </div>
    </div>
  );
}

function SitesCard({
  projectId,
  sites,
}: {
  projectId: string;
  sites: AiTraffic["sites"];
}) {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["ai-traffic", projectId] });
  const add = useMutation({
    mutationFn: (value: { vercelProjectId: string; hosts: string }) =>
      addAiTrafficSite({
        data: {
          projectId,
          vercelProjectId: value.vercelProjectId,
          hosts: value.hosts.split(/[\s,]+/).filter(Boolean),
        },
      }),
    onSuccess: async () => {
      form.reset();
      toast.success("Site added. Re-run the receiver deploy to cover it.");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (siteId: string) =>
      removeAiTrafficSite({ data: { projectId, siteId } }),
    onSuccess: refresh,
  });
  const form = useForm({
    defaultValues: { vercelProjectId: "", hosts: "" },
    onSubmit: ({ value }) => add.mutate(value),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vercel projects</CardTitle>
        <CardDescription>
          The drain sends requests from these Vercel projects. Hosts are
          optional; leave empty to keep every host.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sites.map((site) => (
          <div key={site.id} className="flex items-center gap-3 text-sm">
            <code>{site.vercelProjectId}</code>
            <span className="text-muted-foreground">
              {site.hosts.join(", ") || "all hosts"}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={remove.isPending}
              onClick={() => remove.mutate(site.id)}
            >
              Remove
            </Button>
          </div>
        ))}
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="vercelProjectId">
            {(field) => (
              <Field className="w-64">
                <FieldLabel htmlFor={field.name}>Vercel project id</FieldLabel>
                <Input
                  id={field.name}
                  placeholder="prj_…"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="hosts">
            {(field) => (
              <Field className="w-80">
                <FieldLabel htmlFor={field.name}>Hosts (optional)</FieldLabel>
                <Input
                  id={field.name}
                  placeholder="example.com, www.example.com"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
          <Button type="submit" disabled={add.isPending}>
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Summary({ summary }: { summary: AiTraffic["summary"] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CountTable title="AI crawlers" rows={summary.crawlers} />
      <CountTable
        title="AI agents fetching for a person"
        rows={summary.userFetches}
      />
      <CountTable
        title="Visits referred by AI answers"
        rows={summary.referrals}
      />
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Most-hit paths</TableHead>
              <TableHead className="text-right">Hits</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.topPaths.map((row) => (
              <TableRow key={row.path}>
                <TableCell className="max-w-96 truncate">{row.path}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.hits}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
      <p className="text-sm text-muted-foreground lg:col-span-2">
        {summary.from} → {summary.to}. {summary.discarded} non-AI requests were
        counted and dropped at the edge. Only “verified” crawler hits came from
        the operator’s published IP ranges.
      </p>
    </div>
  );
}

function CountTable({ title, rows }: { title: string; rows: CountRow[] }) {
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{title}</TableHead>
            <TableHead>Verification</TableHead>
            <TableHead className="text-right">Hits</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-muted-foreground">
                None in this period.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={`${row.operator}-${row.product}-${row.verification ?? ""}`}
              >
                <TableCell>
                  {row.product}
                  <span className="text-muted-foreground">
                    {" "}
                    · {row.operator}
                    {row.purpose ? ` · ${row.purpose}` : ""}
                  </span>
                </TableCell>
                <TableCell>
                  {row.verification ? (
                    <Badge
                      variant={
                        row.verification === "verified"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {VERIFICATION_LABEL[row.verification]}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.hits}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableCard>
  );
}
