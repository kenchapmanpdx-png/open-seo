import { createFileRoute } from "@tanstack/react-router";
import { ByokPage } from "@/client/features/ai-visibility-byok/ByokPage";
import { pageHead } from "@/client/lib/pageHead";

export const Route = createFileRoute(
  "/_app/p/$projectId/handbook/ai-visibility-byok",
)({
  head: () => pageHead("AI visibility (own keys)"),
  component: ByokRoute,
});

function ByokRoute() {
  const { projectId } = Route.useParams();
  return <ByokPage projectId={projectId} />;
}
