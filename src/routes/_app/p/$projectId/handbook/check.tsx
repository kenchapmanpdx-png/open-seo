import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CheckSitePage } from "@/client/features/handbook/CheckSitePage";
import { pageHead } from "@/client/lib/pageHead";

/** "Check a site" (fork B14 WO-B14-004, A15). */
export const Route = createFileRoute("/_app/p/$projectId/handbook/check")({
  head: () => pageHead("Check a site"),
  validateSearch: z.object({ auditId: z.string().optional() }),
  component: CheckSiteRoute,
});

function CheckSiteRoute() {
  const { projectId } = Route.useParams();
  const { auditId } = Route.useSearch();
  return <CheckSitePage projectId={projectId} auditId={auditId} />;
}
