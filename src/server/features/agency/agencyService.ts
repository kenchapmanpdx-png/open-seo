import type { EvidenceStore } from "@/server/features/handbook/contracts/evidence-store";
import { createMemoryEvidenceStore } from "@/server/features/handbook/engine/memory-evidence-store";
import { createSupabaseEvidenceStore } from "@/server/features/handbook/engine/supabase-evidence-store";
import type { ClientReportBrand } from "@/server/features/handbook/export/client-report";
import { ReportTemplateService } from "@/server/features/reports/services/ReportTemplateService";
import { AppError } from "@/server/lib/errors";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";
import {
  getBrand,
  getClient,
  projectExists,
  upsertBrand,
  upsertClient,
} from "./AgencyRepository";
import type { AgencyBrand } from "./contracts";

// Agency layer (ADR-017 §1–2): white-label brand for the client report,
// client record per project, and the seeded "Client SEO/GEO report" template.

type Scope = { projectId: string; organizationId: string };

/** Logos above this are not stored; the report shows the agency name instead. */
export const MAX_LOGO_BYTES = 50_000;
const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const TEMPLATE = {
  name: "Client SEO/GEO report",
  description:
    "Use for a client-facing SEO and AI search report on this project's site.",
  instructions: [
    "Audience: the business owner, not an SEO specialist. Plain words, no jargon without a one-line explanation.",
    "Sections in order: 1) Grade and what it means; 2) Top fixes (what, why it matters, effort, affected pages); 3) All findings by severity with evidence; 4) What passed; 5) What needs the client's access; 6) Platform limits; 7) Results since the last report, when outcome checks exist; 8) How the review works.",
    "Tone: direct and specific. Quote the evidence; never promise rankings or traffic.",
    "Sign-off: the agency name and contact line from the brand settings.",
  ].join("\n"),
};

async function evidenceStore(): Promise<EvidenceStore> {
  const url = await getOptionalEnvValue("SUPABASE_URL");
  const serviceRoleKey = await getOptionalEnvValue("SUPABASE_SERVICE_ROLE_KEY");
  if (url && serviceRoleKey)
    return createSupabaseEvidenceStore({ url, serviceRoleKey });
  console.warn("agency: Supabase storage not configured; logo not persisted");
  return createMemoryEvidenceStore();
}

async function assertProject(scope: Scope) {
  if (!(await projectExists(scope.projectId, scope.organizationId)))
    throw new AppError("NOT_FOUND", "Project not found.");
}

function toDataUri(path: string, bytes: Uint8Array) {
  const ext = path.split(".").pop() ?? "";
  const type = Object.keys(LOGO_TYPES).find((t) => LOGO_TYPES[t] === ext);
  return type
    ? `data:${type};base64,${Buffer.from(bytes).toString("base64")}`
    : null;
}

/** Brand for the client report renderer; undefined → neutral look. */
async function getBrandForRender(
  organizationId: string,
): Promise<ClientReportBrand | undefined> {
  const brand = await getBrand(organizationId);
  if (!brand) return undefined;
  const bytes = brand.logoPath
    ? await (await evidenceStore()).get(brand.logoPath)
    : null;
  return {
    agencyName: brand.agencyName,
    accentColor: brand.accentColor ?? "#1a1a1a",
    contactLine: brand.contactLine,
    footerText: brand.footerText,
    hideOpenseoCredit: brand.hideOpenseoCredit,
    logoDataUri:
      bytes && brand.logoPath ? toDataUri(brand.logoPath, bytes) : null,
  };
}

async function getSettings(scope: Scope) {
  await assertProject(scope);
  const [brand, client] = await Promise.all([
    getBrandForRender(scope.organizationId),
    getClient(scope.projectId, scope.organizationId),
  ]);
  return { brand: brand ?? null, client };
}

async function seedTemplate(scope: Scope, userId: string) {
  const { templates, remaining } =
    await ReportTemplateService.listReportTemplates(scope.projectId);
  if (remaining === 0 || templates.some((t) => t.name === TEMPLATE.name))
    return false;
  await ReportTemplateService.saveReportTemplate({
    projectId: scope.projectId,
    ...TEMPLATE,
    createdBy: "agency",
    createdByUserId: userId,
  });
  return true;
}

async function saveBrand(
  scope: Scope & { userId: string },
  input: AgencyBrand & {
    logo: { contentType: string; base64: string } | null;
    removeLogo: boolean;
  },
) {
  await assertProject(scope);
  const previous = await getBrand(scope.organizationId);
  let logoPath = input.removeLogo ? null : (previous?.logoPath ?? null);
  let logoTooLarge = false;
  if (input.logo) {
    const ext = LOGO_TYPES[input.logo.contentType];
    if (!ext)
      throw new AppError(
        "VALIDATION_ERROR",
        "Logo must be PNG, JPEG, WebP or GIF.",
      );
    const bytes = new Uint8Array(Buffer.from(input.logo.base64, "base64"));
    if (bytes.byteLength > MAX_LOGO_BYTES) {
      logoTooLarge = true;
      logoPath = null;
    } else {
      const digest = Buffer.from(
        await crypto.subtle.digest("SHA-256", bytes),
      ).toString("hex");
      const stored = await (
        await evidenceStore()
      ).put(
        `agency/${scope.organizationId}/logo-${digest.slice(0, 16)}.${ext}`,
        bytes,
        input.logo.contentType,
      );
      logoPath = stored.key;
    }
  }
  await upsertBrand({
    organizationId: scope.organizationId,
    agencyName: input.agencyName,
    accentColor: input.accentColor,
    contactLine: input.contactLine,
    footerText: input.footerText,
    hideOpenseoCredit: input.hideOpenseoCredit,
    logoPath,
  });
  const templateSeeded = await seedTemplate(scope, scope.userId);
  return { logoTooLarge, templateSeeded };
}

async function saveClient(
  scope: Scope,
  input: {
    clientName: string;
    contactName: string | null;
    contactEmail: string | null;
    reportCadence: "none" | "monthly" | "quarterly";
    notes: string | null;
  },
) {
  await assertProject(scope);
  await upsertClient({ ...scope, ...input });
}

export const AgencyService = {
  getSettings,
  getBrandForRender,
  saveBrand,
  saveClient,
};
