import { createFileRoute } from "@tanstack/react-router";
import { AgencySettings } from "@/client/features/agency/AgencySettings";
import { pageHead } from "@/client/lib/pageHead";

export const Route = createFileRoute("/_app/p/$projectId/handbook/agency")({
  head: () => pageHead("Agency"),
  component: AgencyRoute,
});

function AgencyRoute() {
  const { projectId } = Route.useParams();
  return <AgencySettings projectId={projectId} />;
}
