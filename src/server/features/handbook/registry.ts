// Handbook v4.6 §41 checklist registry: one entry per item, document order.
// Data: registry.json. `text` is verbatim from
// fork/handbook/on-site-seo-geo-reference-unified-v4.6.md; registry.test.ts and
// fork/scripts/handbook-sync.ts diff it against the handbook. Classification
// (class, automatable, severity, evidence) is B1 judgment; see registry-types.ts.
import { z } from "zod";
import { registryEntrySchema } from "./contracts/registry-types";
import registryJson from "./registry.json";

export const HANDBOOK_VERSION = "4.6";

export const REGISTRY = z.array(registryEntrySchema).parse(registryJson);
