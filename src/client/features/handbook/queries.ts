import { queryOptions } from "@tanstack/react-query";
import {
  getHandbookRun,
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

export const handbookRunQuery = (projectId: string, runId: string) =>
  queryOptions({
    queryKey: ["handbook", projectId, "runs", runId],
    queryFn: () => getHandbookRun({ data: { projectId, runId } }),
  });

export const handbookEvidenceQuery = (projectId: string, runId: string) =>
  queryOptions({
    queryKey: ["handbook", projectId, "runs", runId, "evidence"],
    queryFn: () => listHandbookEvidence({ data: { projectId, runId } }),
  });
