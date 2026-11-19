import type { CollectedData } from "@/server/features/handbook/contracts/collectors";
import type { RegistryEntry } from "@/server/features/handbook/contracts/registry-types";
import {
  SP_CODES,
  type HandbookMode,
  type SiteProfileAnswer,
  type SiteTier,
  type SpCode,
} from "@/server/features/handbook/contracts/status";
import { withOperatorDisabled } from "./operator-disabled";

/**
 * P0 intake (handbook §0, EP-2/EP-3): infer SP1–SP12 from the live site with
 * evidence + confidence, assign the tier, then evaluate every item's tier,
 * mode and gate tags → the applicable item set. `?` gates make their items
 * BLOCKED (UNKNOWN rule), never silently N/A.
 */
export type Intake = {
  siteProfile: SiteProfileAnswer[];
  tier: SiteTier;
  tierEvidence: string;
  applicable: Map<string, RegistryEntry>;
  /** Items filtered out at intake, with their status + reason. */
  excluded: { itemId: string; status: "NA" | "BLOCKED"; note: string }[];
};

import {
  facts,
  hasType,
  INFER,
  internalMatches,
  no,
  sample,
  yes,
  type Answer,
  type Facts,
} from "./site-facts";

const SP_ORDER: readonly SpCode[] = SP_CODES;
const TIER_RANK: Record<SiteTier, number> = { T1: 1, T2: 2, T3: 3, T4: 4 };
const TAG_TIER_RANK: Record<
  NonNullable<RegistryEntry["tags"]["tier"]>,
  number
> = {
  "T1+": 1,
  "T2+": 2,
  "T3+": 3,
  T4: 4,
};
const isSpCode = (value: string): value is SpCode =>
  (SP_CODES as readonly string[]).includes(value);

function inferTier(
  f: Facts,
  sp: Partial<Record<SpCode, Answer>>,
  collected: Partial<CollectedData>,
) {
  const commerce = (["SP2", "SP8", "SP10"] as const).filter(
    (c) => sp[c]?.value === "Y",
  );
  const login = internalMatches(
    f,
    /\/(login|log-in|signin|sign-in|account|my-account|dashboard)(\/|$|\?)/i,
  );
  if (commerce.length || login.length) {
    return {
      tier: "T4" as const,
      evidence: commerce.length
        ? `${commerce.join(", ")}=Y`
        : `user areas: ${sample(login)}`,
    };
  }
  // EP-3: T3 = one collection template with ≥10 URLs or ≥3 with ≥3 URLs.
  // Templates key on pattern + skeleton, so distinct /pages/* siblings stay apart.
  const collections =
    collected.templates?.status === "ok"
      ? collected.templates.templates.filter(
          (t) => t.urlPattern.includes("*") && t.urls.length >= 3,
        )
      : [];
  const large = collections.filter((t) => t.urls.length >= 10);
  if (large.length || collections.length >= 3) {
    return {
      tier: "T3" as const,
      evidence: `collection templates: ${collections.map((t) => `${t.urlPattern} (${t.urls.length})`).join(", ")}`,
    };
  }
  const content = f.pages.filter(
    (p) =>
      p.status === 200 && !/privacy|terms|legal|cookie|imprint/i.test(p.url),
  );
  return content.length > 1
    ? {
        tier: "T2" as const,
        evidence: `${content.length} non-legal pages${collections.length ? `; templates below T3 size: ${collections.map((t) => `${t.urlPattern} (${t.urls.length})`).join(", ")}` : ", no collection template"}`,
      }
    : { tier: "T1" as const, evidence: "single content page" };
}

/** Gate text (registry `tags.gate`) → Y/N/? with evidence. */
type Profile = Partial<Record<SpCode, Answer>>;
const UNKNOWN: Answer = {
  value: "?",
  evidence: "not inferred",
  confidence: "low",
};

function evaluateGate(gate: string, f: Facts, profile: Profile): Answer {
  const sp = (code: SpCode) => profile[code] ?? UNKNOWN;
  if (isSpCode(gate)) return sp(gate);
  const either = (a: Answer, b: Answer): Answer =>
    a.value === "Y" || b.value === "Y"
      ? yes(`${a.evidence}; ${b.evidence}`)
      : a.value === "?" || b.value === "?"
        ? {
            value: "?",
            evidence: `${a.evidence}; ${b.evidence}`,
            confidence: "low",
          }
        : no(`${a.evidence}; ${b.evidence}`);
  const typeGate = (re: RegExp, path: RegExp, label: string): Answer => {
    const types = hasType(f, re);
    const paths = f.pages.map((p) => p.url).filter((u) => path.test(u));
    if (types.length) return yes(`JSON-LD ${sample(types)}`, "high");
    if (paths.length) return yes(`${label} URLs: ${sample(paths)}`, "low");
    return no(`no ${label} markup or URLs`);
  };
  const event = () =>
    typeGate(/Event$/, /\/(events?|races?|calendar)\//i, "event");
  const article = () =>
    typeGate(
      /^(Article|BlogPosting|NewsArticle)$/,
      /\/(blog|news|articles?|posts?)\//i,
      "article",
    );
  switch (gate) {
    case "Event pages":
    case "§24 Event":
      return event();
    case "Article pages":
      return article();
    case "SP6 or publisher":
      return either(sp("SP6"), article());
    case "SP8 or paginated lists": {
      const pagination = internalMatches(f, /[?&]page=\d|\/page\/\d+/i);
      return either(
        sp("SP8"),
        pagination.length
          ? yes(`pagination: ${sample(pagination)}`)
          : no("no pagination links"),
      );
    }
    case "SP2+SP10":
      return sp("SP2").value === "Y" && sp("SP10").value === "Y"
        ? yes("SP2=Y and SP10=Y")
        : sp("SP2").value === "N" || sp("SP10").value === "N"
          ? no(`SP2=${sp("SP2").value}, SP10=${sp("SP10").value}`, "medium")
          : {
              value: "?",
              evidence: `SP2=${sp("SP2").value}, SP10=${sp("SP10").value}`,
              confidence: "low",
            };
    case "§24 FAQPage":
      return typeGate(/^FAQPage$/, /\/faqs?(\/|$)/i, "FAQ");
    case "§24 Review / VideoObject":
      return either(sp("SP5"), sp("SP4"));
    case "admin/staff paths exist": {
      const admin = internalMatches(
        f,
        /\/(admin|wp-admin|staff|backend|cms)(\/|$)/i,
      );
      return admin.length
        ? yes(`admin links: ${sample(admin)}`)
        : no("no admin/staff links found");
    }
    case "API/backend-driven pages":
      if (f.apiRequests === null)
        return {
          value: "?",
          evidence: "no render: API calls not observed",
          confidence: "low",
        };
      return f.apiRequests.length
        ? yes(`rendered pages call ${sample(f.apiRequests)}`, "high")
        : no("rendered samples make no same-site fetch/XHR", "medium");
    case "§15 hero video": {
      const videos = f.pages.filter((p) => p.markup.videos.length > 0);
      return videos.length
        ? yes(`<video> on ${sample(videos.map((p) => p.url))}`, "high")
        : no("no <video> on crawled pages", "medium");
    }
    case "§20":
    case "§20–22":
      return no(
        "handbook §0: no named consumer verified for llms.txt / .md mirrors",
        "high",
      );
    default:
      return {
        value: "?",
        evidence: `gate "${gate}" needs owner/render evidence`,
        confidence: "low",
      };
  }
}

export function runIntake(input: {
  collected: Partial<CollectedData>;
  registry: readonly RegistryEntry[];
  mode: HandbookMode;
  tierOverride?: SiteTier | null;
  maxPages: number;
}): Intake {
  const f = facts(input.collected, input.maxPages);
  const sp: Partial<Record<SpCode, Answer>> = {};
  for (const code of SP_ORDER) sp[code] = INFER[code](f, sp);
  const inferred = inferTier(f, sp, input.collected);
  const tier = input.tierOverride ?? inferred.tier;
  const tierEvidence = input.tierOverride
    ? `override (inferred ${inferred.tier}: ${inferred.evidence})`
    : inferred.evidence;

  const applicable = new Map<string, RegistryEntry>();
  const excluded: Intake["excluded"] = [];
  for (const item of input.registry) {
    const { tags } = item;
    if (tags.review && input.mode !== "REVIEW") {
      excluded.push({
        itemId: item.id,
        status: "NA",
        note: "REVIEW-mode item",
      });
      continue;
    }
    if (tags.audit && input.mode === "BUILD") {
      excluded.push({
        itemId: item.id,
        status: "NA",
        note: "[AUDIT] item in BUILD mode",
      });
      continue;
    }
    if (tags.tier && TIER_RANK[tier] < TAG_TIER_RANK[tags.tier]) {
      excluded.push({
        itemId: item.id,
        status: "NA",
        note: `tier ${tags.tier} > site ${tier}`,
      });
      continue;
    }
    if (tags.gate) {
      const gate = evaluateGate(tags.gate, f, sp);
      if (gate.value === "N") {
        excluded.push({
          itemId: item.id,
          status: "NA",
          note: `gate "${tags.gate}" = N (${gate.evidence})`,
        });
        continue;
      }
      if (gate.value === "?") {
        excluded.push({
          itemId: item.id,
          status: "BLOCKED",
          note: `gate "${tags.gate}" = ? (${gate.evidence})`,
        });
        continue;
      }
    }
    applicable.set(item.id, item);
  }

  return withOperatorDisabled({
    siteProfile: SP_ORDER.map((code) => ({ code, ...(sp[code] ?? UNKNOWN) })),
    tier,
    tierEvidence,
    applicable,
    excluded,
  });
}
