import { createFileRoute } from "@tanstack/react-router";
import { BingPage } from "@/client/features/bing/BingPage";
import { pageHead } from "@/client/lib/pageHead";

export const Route = createFileRoute("/_app/p/$projectId/handbook/bing")({
  head: () => pageHead("Bing"),
  component: BingRoute,
});

function BingRoute() {
  const { projectId } = Route.useParams();
  return <BingPage projectId={projectId} />;
}
