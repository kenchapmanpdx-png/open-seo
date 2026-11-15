import { createFileRoute } from "@tanstack/react-router";
import { CommonCrawlPage } from "@/client/features/commoncrawl/CommonCrawlCard";
import { pageHead } from "@/client/lib/pageHead";

export const Route = createFileRoute(
  "/_app/p/$projectId/handbook/backlinks-cc",
)({
  head: () => pageHead("Backlinks (Common Crawl)"),
  component: CommonCrawlRoute,
});

function CommonCrawlRoute() {
  const { projectId } = Route.useParams();
  return <CommonCrawlPage projectId={projectId} />;
}
