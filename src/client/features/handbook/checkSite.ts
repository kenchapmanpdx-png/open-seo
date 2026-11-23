import { normalizeDomain } from "@/types/schemas/domain";

/**
 * "Check a site" (B14 WO-B14-004, fork/NOVICE-UI.md §2): one button that
 * picks or creates the project for a website, saves the full-check setting
 * and starts a site audit (the Handbook run follows the audit). Pure; the
 * page passes the server functions in.
 */
export const CHECK_SIZES = {
  whole: { pages: 500, label: "Whole site (up to 500 pages)" },
  quick: { pages: 50, label: "Quick (50 pages)" },
} as const;
export type CheckSize = keyof typeof CHECK_SIZES;
export const CHECK_SIZE_KEYS: readonly CheckSize[] = ["whole", "quick"];

type Project = { id: string; domain: string | null };
type Settings = {
  enabled: boolean;
  mode: "BUILD" | "AUDIT" | "MAINTAIN";
  tierOverride: "T1" | "T2" | "T3" | "T4" | null;
  copyQuality: boolean;
  serpOriginality: boolean;
};

export type CheckSiteDeps = {
  listProjects: () => Promise<Project[]>;
  createProject: (name: string) => Promise<{ id: string }>;
  setProjectDomain: (projectId: string, domain: string) => Promise<unknown>;
  getSettings: (projectId: string) => Promise<Settings>;
  saveSettings: (projectId: string, settings: Settings) => Promise<unknown>;
  startAudit: (payload: {
    projectId: string;
    startUrl: string;
    maxPages: number;
    renderJavaScript: false;
    excludePaths?: string[];
  }) => Promise<{ auditId: string }>;
};

/** Bare lowercase host without www, or null when the input is not a site. */
function siteDomain(input: string): string | null {
  try {
    const host = normalizeDomain(input);
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

/**
 * Runs the check. A new domain gets a project without a domain first, and
 * the domain is set only after the audit started: setting a domain on a
 * project with no audit starts upstream's 50-page first audit, which would
 * run next to this one.
 */
export async function checkSite(
  input: {
    currentProject: Project;
    website: string;
    size: CheckSize;
    fullCheck: boolean;
    /** Sections to leave out (B18 WO-B18-015), upstream exclude-path syntax. */
    excludePaths?: string[];
  },
  deps: CheckSiteDeps,
): Promise<{ projectId: string; auditId: string }> {
  const domain = siteDomain(input.website);
  if (!domain) throw new Error("Enter a website like example.com.");

  const current = input.currentProject;
  let projectId: string | null = current.domain === domain ? current.id : null;
  projectId ??=
    (await deps.listProjects()).find((p) => p.domain === domain)?.id ?? null;
  const isNew = projectId === null;
  // A project with no site yet takes this one instead of a second project
  // for the same site (B18 WO-B18-008).
  if (projectId === null && current.domain === null) projectId = current.id;
  if (projectId === null) projectId = (await deps.createProject(domain)).id;

  const settings = await deps.getSettings(projectId);
  if (settings.enabled !== input.fullCheck)
    await deps.saveSettings(projectId, {
      ...settings,
      enabled: input.fullCheck,
    });

  const { auditId } = await deps.startAudit({
    projectId,
    startUrl: `https://${domain}`,
    maxPages: CHECK_SIZES[input.size].pages,
    renderJavaScript: false,
    ...(input.excludePaths?.length ? { excludePaths: input.excludePaths } : {}),
  });
  if (isNew) await deps.setProjectDomain(projectId, domain);
  return { projectId, auditId };
}
