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
  listProjects: vi.fn<CheckSiteDeps["listProjects"]>(),
  createProject: vi.fn<CheckSiteDeps["createProject"]>(),
  setProjectDomain: vi.fn<CheckSiteDeps["setProjectDomain"]>(),
  getSettings: vi.fn<CheckSiteDeps["getSettings"]>(),
  saveSettings: vi.fn<CheckSiteDeps["saveSettings"]>(),
  startAudit: vi.fn<CheckSiteDeps["startAudit"]>(),
};

const current = { id: "p1", domain: "acme.com" };

beforeEach(() => {
  deps.listProjects.mockResolvedValue([current, { id: "p2", domain: "b.io" }]);
  deps.createProject.mockResolvedValue({ id: "new" });
  deps.getSettings.mockResolvedValue(settings);
  deps.startAudit.mockResolvedValue({ auditId: "a1" });
  deps.setProjectDomain.mockResolvedValue(undefined);
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
        currentProject: { id: "empty", domain: null },
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
});
