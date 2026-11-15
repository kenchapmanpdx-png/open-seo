import { createFileRoute } from "@tanstack/react-router";
import { ProjectOverview } from "@/client/features/agency/ProjectOverview";
import { pageHead } from "@/client/lib/pageHead";

export const Route = createFileRoute("/_app/p/$projectId/handbook/overview")({
  head: () => pageHead("Overview"),
  component: OverviewRoute,
});

function OverviewRoute() {
  const { projectId } = Route.useParams();
  return <ProjectOverview projectId={projectId} />;
}
