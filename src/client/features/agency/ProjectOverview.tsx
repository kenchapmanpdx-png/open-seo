import { queryOptions, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryState } from "@/client/components/QueryState";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { getProjectOverview } from "@/server/features/agency/functions";

// One-screen project overview (B7 R1): handbook findings, AI traffic, AI
// answer mentions, monthly cost estimate. Each card links to its page.

const overviewQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["project-overview", projectId],
    queryFn: () => getProjectOverview({ data: { projectId } }),
  });

type Overview = Awaited<ReturnType<typeof getProjectOverview>>;

const usd = (n: number) => `$${n.toFixed(2)}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function OverviewCard({
  title,
  description,
  children,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {children}
      </CardContent>
    </Card>
  );
}

function Cards({ projectId, data }: { projectId: string; data: Overview }) {
  const { handbook, aiTraffic, aiAnswers, cost } = data;
  const params = { projectId };
  return (
    <>
      <OverviewCard
        title="Handbook findings"
        description={
          handbook ? (
            <Link
              to="/p/$projectId/handbook/$runId"
              params={{ projectId, runId: handbook.runId }}
            >
              Latest completed run
            </Link>
          ) : (
            "No completed handbook run yet."
          )
        }
      >
        {handbook && (
          <>
            <Stat label="Grade" value={handbook.grade} />
            <Stat label="Findings" value={String(handbook.findings)} />
            <Stat
              label="S1 / S2"
              value={`${handbook.bySeverity.S1 ?? 0} / ${handbook.bySeverity.S2 ?? 0}`}
            />
            <Stat label="Needs access" value={String(handbook.blocked)} />
          </>
        )}
      </OverviewCard>
      <OverviewCard
        title="AI traffic (28 days)"
        description={
          aiTraffic ? (
            <Link to="/p/$projectId/handbook/ai-traffic" params={params}>
              {aiTraffic.from} to {aiTraffic.to}
            </Link>
          ) : (
            "No AI traffic site connected."
          )
        }
      >
        {aiTraffic && (
          <>
            <Stat label="AI referrals" value={String(aiTraffic.referrals)} />
            <Stat label="User fetches" value={String(aiTraffic.userFetches)} />
            <Stat
              label="Verified crawler hits"
              value={String(aiTraffic.crawlersVerified)}
            />
            <Stat
              label="All crawler hits"
              value={String(aiTraffic.crawlersTotal)}
            />
          </>
        )}
      </OverviewCard>
      <OverviewCard
        title="AI answers"
        description={
          <Link to="/p/$projectId/handbook/ai-visibility-byok" params={params}>
            Share of answers in the latest run that mention the brand
          </Link>
        }
      >
        <Stat
          label="AI visibility"
          value={
            aiAnswers.upstream
              ? `${pct(aiAnswers.upstream.rate)} of ${aiAnswers.upstream.answers}`
              : "no run"
          }
        />
        <Stat
          label="Own keys (BYOK)"
          value={
            aiAnswers.byok
              ? `${pct(aiAnswers.byok.rate)} of ${aiAnswers.byok.answers}`
              : "no run"
          }
        />
      </OverviewCard>
      <OverviewCard
        title="Cost per month (estimate)"
        description={cost.excludes}
      >
        <Stat label="Estimate" value={usd(cost.estimateUsd)} />
        <Stat
          label="Handbook AI review, 30 days"
          value={usd(cost.last30Days.handbookLlmUsd)}
        />
        <Stat
          label={`BYOK, 30 days (${cost.last30Days.byokRuns} runs)`}
          value={usd(cost.last30Days.byokUsd)}
        />
        <Stat
          label="BYOK schedule"
          value={
            cost.byokScheduleDays
              ? `every ${cost.byokScheduleDays} days`
              : "manual"
          }
        />
      </OverviewCard>
    </>
  );
}

export function ProjectOverview({ projectId }: { projectId: string }) {
  const query = useQuery(overviewQuery(projectId));
  return (
    <div className="overflow-auto px-4 py-4 pb-24 md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <PageHeader
          title="Overview"
          description="Handbook findings, AI traffic and AI answers for this project."
        />
        <QueryState query={query} errorFallback="Failed to load the overview">
          {(data) => <Cards projectId={projectId} data={data} />}
        </QueryState>
      </div>
    </div>
  );
}
