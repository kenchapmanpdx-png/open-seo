import type { CollectedData } from "@/server/features/handbook/contracts/collectors";

/** First 2 script srcs + first 2 stylesheets on the home snapshot, same host. */
export function assetUrls(collected: Partial<CollectedData>) {
  if (collected.pages?.status !== "ok") return [];
  const home = collected.pages.snapshots.find(
    (s) => new URL(s.url).pathname === "/" && s.status === 200,
  );
  if (!home) return [];
  const host = new URL(home.finalUrl).host;
  const sameHost = (url: string) => {
    try {
      return new URL(url).host === host;
    } catch {
      return false;
    }
  };
  const scripts = home.markup.scripts
    .flatMap((s) => (s.src ? [s.src] : []))
    .filter(sameHost)
    .slice(0, 2);
  const styles = home.markup.headLinks
    .filter((l) => /\bstylesheet\b/i.test(l.rel))
    .map((l) => l.href)
    .filter(sameHost)
    .slice(0, 2);
  return [...new Set([...scripts, ...styles])];
}
