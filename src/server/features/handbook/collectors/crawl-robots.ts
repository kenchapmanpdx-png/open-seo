import { decide } from "@/server/features/handbook/engine/robots";
import type { CollectedData } from "@/server/features/handbook/contracts/collectors";

/** Robots verdict for `OpenSEO-Handbook`; hosts without a robots.txt read allowed. */
export function robotsAllowed(collected: Partial<CollectedData>, url: string) {
  const robots = collected.robots?.status === "ok" ? collected.robots : null;
  const { host, pathname, search } = new URL(url);
  const hostRobots = robots?.hosts.find((h) => h.host === host);
  // WO-B23-003: path + query, as Google matches rules like `/*?s=`.
  return (
    !hostRobots ||
    decide(host, hostRobots.groups, "OpenSEO-Handbook", pathname + search)
      .allowed
  );
}
