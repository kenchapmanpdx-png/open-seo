import { createFileRoute } from "@tanstack/react-router";
import { HandbookRunsPage } from "@/client/features/handbook/HandbookRunsPage";
import { pageHead } from "@/client/lib/pageHead";

export const Route = createFileRoute("/_app/p/$projectId/handbook/")({
  head: () => pageHead("Handbook"),
  component: HandbookRoute,
});

function HandbookRoute() {
  const { projectId } = Route.useParams();
  return <HandbookRunsPage projectId={projectId} />;
}
