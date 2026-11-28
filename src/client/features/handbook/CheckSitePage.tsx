import { useEffect, useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryError } from "@/client/components/QueryState";
import { Button } from "@/client/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Checkbox } from "@/client/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/client/components/ui/field";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import {
  excludePathsSchema,
  splitExcludePathsInput,
} from "@/shared/audit-exclude-paths";
import { Progress } from "@/client/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/client/components/ui/radio-group";
import { projectsQueryOptions } from "@/client/features/projects/projectQueries";
import { createProject, updateProject } from "@/serverFunctions/projects";
import { getAuditStatus, startAudit } from "@/serverFunctions/audit";
import {
  getHandbookSettings,
  previewHandbookScope,
  updateHandbookSettings,
  verifyHandbookWebsite,
} from "@/server/features/handbook/functions";
import {
  CHECK_SIZE_KEYS,
  CHECK_SIZES,
  checkSite,
  siteDomain,
  type CheckSize,
} from "./checkSite";
import { runButtonView } from "./forkHealthView";
import { forkHealthQuery, handbookRunsQuery } from "./queries";
import { RunProgress } from "./RunProgress";

const POLL_MS = 5_000;

/**
 * "Check a site" (B14 WO-B14-004): one form that runs a site audit and the
 * full Handbook check, shows both steps, then opens the Fix List. With an
 * `auditId` in the URL the page shows the progress of that check.
 */
export function CheckSitePage({
  projectId,
  auditId,
}: {
  projectId: string;
  auditId: string | undefined;
}) {
  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader
          title="Check a site"
          description="Reads the website, runs the full SEO / GEO / AEO check and gives you a fix list."
        />
        {auditId ? (
          <CheckProgress projectId={projectId} auditId={auditId} />
        ) : (
          <CheckForm projectId={projectId} />
        )}
      </div>
    </div>
  );
}

function CheckForm({ projectId }: { projectId: string }) {
  const id = useId();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const projectsQuery = useQuery(projectsQueryOptions());
  const healthQuery = useQuery(forkHealthQuery());
  const current = projectsQuery.data?.find((p) => p.id === projectId);
  const [website, setWebsite] = useState<string | null>(null);
  const [size, setSize] = useState<CheckSize>("whole");
  const [fullCheck, setFullCheck] = useState(true);
  const [skip, setSkip] = useState("");
  // WO-B27-003: the scope shown before a Whole site run that would leave
  // sections out; the next press starts with the list as edited.
  const [scope, setScope] = useState<ScopeView | null>(null);
  const site = website ?? current?.domain ?? "";
  const scopeKey = `${site.trim().toLowerCase()}|${size}`;
  const shownScope = scope?.key === scopeKey ? scope : null;
  const verify = async (domain: string) => {
    const result = await verifyHandbookWebsite({ data: { website: domain } });
    if (!result.ok) throw new Error(result.reason);
  };

  const run = useMutation({
    mutationFn: async (): Promise<{
      projectId: string;
      auditId: string;
    } | null> => {
      // Re-read health: a database failure blocks the start (WO-B13-014).
      const health = await queryClient.fetchQuery({
        ...forkHealthQuery(),
        staleTime: 0,
      });
      const blocked = runButtonView(health).disabledReason;
      if (blocked) throw new Error(blocked);
      const excludePaths = excludePathsSchema.safeParse(
        splitExcludePathsInput(skip),
      );
      if (!excludePaths.success)
        throw new Error(excludePaths.error.issues[0]?.message);
      if (size === "whole" && !shownScope && excludePaths.data.length === 0) {
        const domain = siteDomain(site);
        if (!domain) throw new Error("Enter a website like example.com.");
        await verify(domain);
        const decision = await previewHandbookScope({
          data: { website: domain, maxPages: CHECK_SIZES.whole.pages },
        });
        if (decision.excludePaths.length > 0) {
          setScope({ key: scopeKey, ...decision });
          setSkip(decision.excludePaths.join("\n"));
          return null;
        }
      }
      return checkSite(
        {
          currentProject: {
            id: projectId,
            domain: current?.domain ?? null,
            name: current?.name ?? "",
          },
          website: site,
          size,
          fullCheck,
          excludePaths: excludePaths.data,
        },
        {
          verifyWebsite: verify,
          previewScope: (domain, maxPages) =>
            previewHandbookScope({ data: { website: domain, maxPages } }),
          listProjects: () => getProjects(queryClient),
          createProject: (name) => createProject({ data: { name } }),
          setProjectDomain: (pid, domain) =>
            updateProject({ data: { projectId: pid, name: domain, domain } }),
          getSettings: async (pid) => {
            const s = await getHandbookSettings({ data: { projectId: pid } });
            return { ...s, mode: s.mode === "REVIEW" ? "AUDIT" : s.mode };
          },
          saveSettings: (pid, settings) =>
            updateHandbookSettings({ data: { projectId: pid, ...settings } }),
          startAudit: (payload) => startAudit({ data: payload }),
        },
      );
    },
    onSuccess: async (result) => {
      if (!result) return;
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      await queryClient.invalidateQueries({
        queryKey: ["handbook", result.projectId],
      });
      void navigate({
        to: "/p/$projectId/handbook/check",
        params: { projectId: result.projectId },
        search: { auditId: result.auditId },
      });
    },
    meta: { errorToast: false },
  });
  const view = runButtonView(healthQuery.data ?? null);

  return (
    <Card>
      <CardContent className="space-y-5">
        <Field>
          <FieldLabel htmlFor={`${id}-site`}>Website</FieldLabel>
          <Input
            id={`${id}-site`}
            value={site}
            placeholder="example.com"
            onChange={(e) => setWebsite(e.target.value)}
            // A click selects the prefilled site, so typing replaces it (WO-B20-010).
            onFocus={(e) => e.currentTarget.select()}
          />
        </Field>
        <FieldSet className="gap-2">
          <FieldLegend variant="label" className="mb-0">
            How much to read
          </FieldLegend>
          <RadioGroup
            value={size}
            onValueChange={(value) => {
              const next = CHECK_SIZE_KEYS.find((k) => k === value);
              if (next) setSize(next);
            }}
          >
            {CHECK_SIZE_KEYS.map((key) => (
              <Field key={key} orientation="horizontal" className="w-auto">
                <RadioGroupItem value={key} id={`${id}-${key}`} />
                <FieldLabel htmlFor={`${id}-${key}`} className="font-normal">
                  {CHECK_SIZES[key].label}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
        </FieldSet>
        <Field>
          <FieldLabel htmlFor={`${id}-skip`}>
            Leave out sections (optional)
          </FieldLabel>
          <Textarea
            id={`${id}-skip`}
            rows={3}
            className="font-mono"
            placeholder={"/blog/\n/tag/\n/category/"}
            value={skip}
            onChange={(e) => setSkip(e.target.value)}
          />
          <FieldDescription>
            One path per line: <code>/blog/</code> skips /blog itself and every
            page under /blog/. On a big site, leave out blog posts, tags and
            categories to check the core pages. Both the page reading and the
            full check skip them.
          </FieldDescription>
        </Field>
        {shownScope ? <ScopeNotice scope={shownScope} /> : null}
        <Field orientation="horizontal" className="w-auto">
          <Checkbox
            id={`${id}-full`}
            checked={fullCheck}
            onCheckedChange={(checked) => setFullCheck(checked)}
          />
          <FieldLabel htmlFor={`${id}-full`} className="font-normal">
            Include the full SEO / GEO / AEO check
          </FieldLabel>
        </Field>
        <div className="space-y-2">
          <Button
            disabled={
              !site.trim() ||
              healthQuery.isPending ||
              !!view.disabledReason ||
              run.isPending
            }
            onClick={() => run.mutate()}
          >
            {run.isPending ? "Starting…" : shownScope ? "Start check" : "Check"}
          </Button>
          {view.disabledReason ? (
            <p className="text-sm text-destructive">{view.disabledReason}</p>
          ) : null}
          {view.warnings.map((warning) => (
            <p
              key={warning}
              className="text-sm text-amber-700 dark:text-amber-400"
            >
              {warning}
            </p>
          ))}
          {run.isError ? (
            <QueryError
              error={run.error}
              fallback="Could not start the check"
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

type ScopeView = Awaited<ReturnType<typeof previewHandbookScope>> & {
  key: string;
};

/** WO-B27-003 step 4: pages in scope, sections left out, the limit. */
function ScopeNotice({ scope }: { scope: ScopeView }) {
  const left = scope.leftOut.map((s) => `${s.section} (${s.count})`);
  return (
    <p className="rounded-md border p-3 text-sm">
      The sitemap lists {scope.census.total} pages; the page limit is{" "}
      {scope.limit}. Automatic core scope: leave out {left.join(", ")}, so{" "}
      {scope.inScope} pages are in scope. Edit the sections above, or press
      Start check.
    </p>
  );
}

const getProjects = async (queryClient: ReturnType<typeof useQueryClient>) =>
  (
    await queryClient.fetchQuery({ ...projectsQueryOptions(), staleTime: 0 })
  ).map((p) => ({ id: p.id, domain: p.domain ?? null, name: p.name }));

/** Step 1: the site audit crawl. Step 2: the Handbook run it starts. */
function CheckProgress({
  projectId,
  auditId,
}: {
  projectId: string;
  auditId: string;
}) {
  const navigate = useNavigate();
  const auditQuery = useQuery({
    queryKey: ["audit-status", projectId, auditId],
    queryFn: () => getAuditStatus({ data: { projectId, auditId } }),
    refetchInterval: (query) =>
      query.state.data?.status === "running" ? POLL_MS : false,
  });
  const audit = auditQuery.data;
  const auditDone = audit?.status === "completed";
  const runsQuery = useQuery({
    ...handbookRunsQuery(projectId),
    enabled: auditDone,
    refetchInterval: (query) => {
      const r = query.state.data?.find((x) => x.auditId === auditId);
      return r && (r.status === "completed" || r.status === "failed")
        ? false
        : POLL_MS;
    },
  });
  const run = runsQuery.data?.find((r) => r.auditId === auditId);

  useEffect(() => {
    if (run?.status === "completed")
      void navigate({
        to: "/p/$projectId/handbook/$runId",
        params: { projectId, runId: run.id },
      });
  }, [run?.status, run?.id, projectId, navigate]);

  if (auditQuery.isError)
    return (
      <QueryError
        error={auditQuery.error}
        fallback="Could not load the check"
      />
    );
  const percent =
    audit && audit.pagesTotal > 0
      ? Math.min(100, Math.round((audit.pagesCrawled / audit.pagesTotal) * 100))
      : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            Step 1 · Reading the site
            {audit?.status === "failed"
              ? " — failed"
              : auditDone
                ? " — done"
                : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={auditDone ? 100 : percent} />
          <p className="text-sm text-muted-foreground">
            {audit
              ? `${audit.pagesCrawled} of ${audit.pagesTotal || "?"} pages read`
              : "Starting…"}
          </p>
          {auditDone || audit?.status === "failed" ? (
            <Link
              to="/p/$projectId/audit"
              params={{ projectId }}
              search={{ auditId }}
              className="text-sm underline"
            >
              Site Audit results
            </Link>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Step 2 · Full check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {!auditDone ? (
            <p>Starts when step 1 is done.</p>
          ) : !run ? (
            <p>
              Waiting for the full check to start. If the full check is off for
              this project, open the Site Audit results above.
            </p>
          ) : run.status === "failed" ? (
            <p>
              The full check failed.{" "}
              <Link
                to="/p/$projectId/handbook/$runId"
                params={{ projectId, runId: run.id }}
                className="underline"
              >
                See what happened
              </Link>
            </p>
          ) : run.status === "completed" ? (
            <p>Done — opening the fix list…</p>
          ) : (
            <RunProgress projectId={projectId} runId={run.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
