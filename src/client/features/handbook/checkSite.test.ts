import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkSite, type CheckSiteDeps } from "./checkSite";

const settings = {
  enabled: false,
  mode: "AUDIT" as const,
  tierOverride: null,
  copyQuality: true,
  serpOriginality: false,
};

const deps = {
  verifyWebsite: vi.fn<CheckSiteDeps["verifyWebsite"]>(),
  listProjects: vi.fn<CheckSiteDeps["listProjects"]>(),
  createProject: vi.fn<CheckSiteDeps["createProject"]>(),
  setProjectDomain: vi.fn<CheckSiteDeps["setProjectDomain"]>(),
  getSettings: vi.fn<CheckSiteDeps["getSettings"]>(),
  saveSettings: vi.fn<CheckSiteDeps["saveSettings"]>(),
  previewScope: vi.fn<CheckSiteDeps["previewScope"]>(),
  startAudit: vi.fn<CheckSiteDeps["startAudit"]>(),
};

const current = { id: "p1", domain: "acme.com", name: "acme.com" };

beforeEach(() => {
  deps.verifyWebsite.mockResolvedValue({ domain: "acme.com" });
  deps.listProjects.mockResolvedValue([
    current,
    { id: "p2", domain: "b.io", name: "b.io" },
  ]);
  deps.createProject.mockResolvedValue({ id: "new" });
  deps.getSettings.mockResolvedValue(settings);
  deps.startAudit.mockResolvedValue({ auditId: "a1" });
  deps.setProjectDomain.mockResolvedValue(undefined);
  deps.previewScope.mockResolvedValue({ excludePaths: [] });
});

describe("checkSite", () => {
  it("checks the current project's site with the whole-site payload", async () => {
    const result = await checkSite(
      {
        currentProject: current,
        website: "https://www.Acme.com/about",
        size: "whole",
        fullCheck: true,
      },
      deps,
    );
    expect(result).toEqual({ projectId: "p1", auditId: "a1" });
    expect(deps.createProject).not.toHaveBeenCalled();
    expect(deps.saveSettings).toHaveBeenCalledWith("p1", {
      ...settings,
      enabled: true,
    });
    expect(deps.startAudit).toHaveBeenCalledWith({
      projectId: "p1",
      startUrl: "https://acme.com",
      maxPages: 500,
      renderJavaScript: false,
    });
  });

  it("reuses another project that already has the domain", async () => {
    const result = await checkSite(
      {
        currentProject: current,
        website: "b.io",
        size: "quick",
        fullCheck: false,
      },
      deps,
    );
    expect(result.projectId).toBe("p2");
    expect(deps.createProject).not.toHaveBeenCalled();
    expect(deps.saveSettings).not.toHaveBeenCalled();
    expect(deps.startAudit.mock.calls[0][0].maxPages).toBe(50);
  });

  it("creates one project for a new domain and sets its domain after the audit starts", async () => {
    const order: string[] = [];
    deps.startAudit.mockImplementation(async () => {
      order.push("start");
      return { auditId: "a2" };
    });
    deps.setProjectDomain.mockImplementation(async () => {
      order.push("domain");
    });
    const result = await checkSite(
      {
        currentProject: current,
        website: "new.dev",
        size: "whole",
        fullCheck: true,
      },
      deps,
    );
    expect(result).toEqual({ projectId: "new", auditId: "a2" });
    expect(deps.createProject).toHaveBeenCalledTimes(1);
    expect(deps.setProjectDomain).toHaveBeenCalledWith("new", "new.dev");
    expect(order).toEqual(["start", "domain"]);
  });

  it("gives a project with no site this site instead of creating a second project", async () => {
    const result = await checkSite(
      {
        currentProject: { id: "empty", domain: null, name: "Shop" },
        website: "new.dev",
        size: "quick",
        fullCheck: true,
        excludePaths: ["/blog/"],
      },
      deps,
    );
    expect(result.projectId).toBe("empty");
    expect(deps.createProject).not.toHaveBeenCalled();
    expect(deps.setProjectDomain).toHaveBeenCalledWith("empty", "new.dev");
    expect(deps.startAudit.mock.calls[0][0].excludePaths).toEqual(["/blog/"]);
  });

  it("rejects input that is not a website before calling the server", async () => {
    await expect(
      checkSite(
        {
          currentProject: current,
          website: "nope",
          size: "whole",
          fullCheck: true,
        },
        deps,
      ),
    ).rejects.toThrow("Enter a website");
    expect(deps.startAudit).not.toHaveBeenCalled();
  });

  // WO-B20-010: `aircorheatingcooling.comsamanthaco.ca` created a project and an empty run.
  it("creates nothing when the website does not answer", async () => {
    deps.verifyWebsite.mockRejectedValue(
      new Error(
        "a.comb.ca does not exist (no DNS record). Check the spelling.",
      ),
    );
    await expect(
      checkSite(
        {
          currentProject: current,
          website: "a.comb.ca",
          size: "whole",
          fullCheck: true,
        },
        deps,
      ),
    ).rejects.toThrow("no DNS record");
    expect(deps.createProject).not.toHaveBeenCalled();
    expect(deps.startAudit).not.toHaveBeenCalled();
  });

  // WO-B27-003: a caller that chose no scope gets the automatic one.
  it("takes the automatic core scope when no sections were chosen", async () => {
    deps.previewScope.mockResolvedValue({ excludePaths: ["/blogs/"] });
    await checkSite(
      {
        currentProject: current,
        website: "acme.com",
        size: "whole",
        fullCheck: true,
      },
      deps,
    );
    expect(deps.previewScope).toHaveBeenCalledWith("acme.com", 500);
    expect(deps.startAudit.mock.calls[0][0].excludePaths).toEqual(["/blogs/"]);
  });

  it("leaves the empty Default project alone and creates one named for the site", async () => {
    const result = await checkSite(
      {
        currentProject: { id: "default", domain: null, name: "Default" },
        website: "new.dev",
        size: "quick",
        fullCheck: true,
      },
      deps,
    );
    expect(deps.createProject).toHaveBeenCalledWith("new.dev");
    expect(result.projectId).toBe("new");
    expect(deps.setProjectDomain).toHaveBeenCalledWith("new", "new.dev");
  });
});
