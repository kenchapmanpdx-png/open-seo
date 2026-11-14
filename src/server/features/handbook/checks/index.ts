import type { HandbookCheck } from "@/server/features/handbook/contracts/check";

/**
 * Every K1 check the runner executes. Exemplars land in B1 R5; the rest via
 * B2 work orders (fork/queue.md). Items without a check report DEFERRED.
 */
export const HANDBOOK_CHECKS: readonly HandbookCheck[] = [];
