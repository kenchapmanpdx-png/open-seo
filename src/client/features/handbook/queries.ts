import { queryOptions } from "@tanstack/react-query";
import {
  getForkHealth,
  getHandbookRun,
  getHandbookRunProgress,
  getHandbookSettings,
  listHandbookEvidence,
  listHandbookRuns,
} from "@/server/features/handbook/functions";

/** TanStack Query options around the handbook server functions (ADR-010). */
export const handbookSettingsQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["handbook", projectId, "settings"],
    queryFn: () => getHandbookSettings({ data: { projectId } }),
  });

export const handbookRunsQuery = (projectId: string) =>
  queryOptions({
    queryKey: ["handbook", projectId, "runs"],
    queryFn: () => listHandbookRuns({ data: { projectId } }),
    // Runs change while a workflow writes them; do not show a stale list.
    staleTime: 0,
  });

const POLL_MS = 5_000;
const isLive = (status: string | undefined) =>
  status === "queued" || status === "running";

export const handbookRunQuery = (projectId: string, runId: string) =>
  queryOptions({
    queryKey: ["handbook", projectId, "runs", runId],
    queryFn: () => getHandbookRun({ data: { projectId, runId } }),
    // Picks up the final report once a live run finishes.
    refetchInterval: (query) =>
      isLive(query.state.data?.run.status) ? POLL_MS : false,
  });

/** Live progress of a queued or running run; polling stops at a final status. */
export const handbookRunProgressQuery = (projectId: string, runId: string) =>
  queryOptions({
    queryKey: ["handbook", projectId, "runs", runId, "progress"],
    queryFn: () => getHandbookRunProgress({ data: { projectId, runId } }),
    refetchInterval: (query) =>
      query.state.data && !isLive(query.state.data.status) ? false : POLL_MS,
  });

export const handbookEvidenceQuery = (projectId: string, runId: string) =>
  queryOptions({
    queryKey: ["handbook", projectId, "runs", runId, "evidence"],
    queryFn: () => listHandbookEvidence({ data: { projectId, runId } }),
  });

/** Fork status (WO-B13-011); null in hosted mode. Polled once a minute. */
export const forkHealthQuery = () =>
  queryOptions({
    queryKey: ["fork-health"],
    queryFn: () => getForkHealth(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
