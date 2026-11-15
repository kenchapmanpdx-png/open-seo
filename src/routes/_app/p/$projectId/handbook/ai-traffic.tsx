import { createFileRoute } from "@tanstack/react-router";
import { AiTrafficPage } from "@/client/features/ai-traffic/AiTrafficPage";
import { pageHead } from "@/client/lib/pageHead";

export const Route = createFileRoute("/_app/p/$projectId/handbook/ai-traffic")({
  head: () => pageHead("AI traffic"),
  component: AiTrafficRoute,
});

function AiTrafficRoute() {
  const { projectId } = Route.useParams();
  return <AiTrafficPage projectId={projectId} />;
}
