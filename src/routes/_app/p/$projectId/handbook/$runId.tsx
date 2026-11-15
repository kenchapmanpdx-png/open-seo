import { createFileRoute } from "@tanstack/react-router";
import { HandbookRunPage } from "@/client/features/handbook/HandbookRunPage";
import { pageHead } from "@/client/lib/pageHead";

export const Route = createFileRoute("/_app/p/$projectId/handbook/$runId")({
  head: () => pageHead("Handbook run"),
  component: HandbookRunRoute,
});

function HandbookRunRoute() {
  const { projectId, runId } = Route.useParams();
  return <HandbookRunPage projectId={projectId} runId={runId} />;
}
