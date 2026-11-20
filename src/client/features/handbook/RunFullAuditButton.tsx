import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { QueryError } from "@/client/components/QueryState";
import { Button } from "@/client/components/ui/button";
import { getDashboardActivation } from "@/serverFunctions/dashboard";
import { startAudit } from "@/serverFunctions/audit";
import { runButtonView } from "./forkHealthView";
import { forkHealthQuery } from "./queries";

/** The fork's full audit size (R7: the 50-page default starved real sites). */
const FULL_AUDIT_PAGES = 500;

/**
 * "Run full audit" on the Handbook page (B13 WO-B13-014): a 500-page site
 * audit of the project's website, which then runs Handbook. Site Audit
 * rendering stays off (it needs Context.dev); Handbook renders through the
 * browser helper. Health is re-read before starting: a database failure
 * blocks the start, a missing helper / key / test mode warns.
 */
export function RunFullAuditButton({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const healthQuery = useQuery(forkHealthQuery());
  const activationQuery = useQuery({
    queryKey: ["dashboardActivation", projectId],
    queryFn: () => getDashboardActivation({ data: { projectId } }),
  });
  const domain = activationQuery.data?.domain ?? null;
  const run = useMutation({
    mutationFn: async () => {
      const health = await queryClient.fetchQuery({
        ...forkHealthQuery(),
        staleTime: 0,
      });
      const blocked = runButtonView(health).disabledReason;
      if (blocked) throw new Error(blocked);
      return startAudit({
        data: {
          projectId,
          startUrl: `https://${domain}`,
          maxPages: FULL_AUDIT_PAGES,
          renderJavaScript: false,
        },
      });
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ["handbook", projectId, "runs"],
      }),
    meta: { errorToast: false },
  });
  const view = runButtonView(healthQuery.data ?? null);

  if (activationQuery.isSuccess && !domain)
    return (
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link to="/p/$projectId/settings" params={{ projectId }} />}
      >
        Add your website to run a full audit
      </Button>
    );
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={
            !domain ||
            healthQuery.isPending ||
            !!view.disabledReason ||
            run.isPending
          }
          onClick={() => run.mutate()}
        >
          {run.isPending ? "Starting…" : "Run full audit"}
        </Button>
        {run.isSuccess ? (
          <span className="text-sm text-muted-foreground">
            Site audit started (up to {FULL_AUDIT_PAGES} pages). Handbook runs
            when it finishes.{" "}
            <Link
              to="/p/$projectId/audit"
              params={{ projectId }}
              search={{ auditId: run.data.auditId }}
              className="underline"
            >
              View site audit
            </Link>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            Site audit of up to {FULL_AUDIT_PAGES} pages, then Handbook.
          </span>
        )}
      </div>
      {view.disabledReason ? (
        <p className="text-sm text-destructive">{view.disabledReason}</p>
      ) : null}
      {view.warnings.map((warning) => (
        <p key={warning} className="text-sm text-amber-700 dark:text-amber-400">
          {warning}
        </p>
      ))}
      {run.isError ? (
        <QueryError error={run.error} fallback="Could not start the audit" />
      ) : null}
    </div>
  );
}
