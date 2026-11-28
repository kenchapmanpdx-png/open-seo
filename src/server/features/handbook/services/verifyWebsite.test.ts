import { beforeEach, describe, expect, it, vi } from "vitest";
import { domainField } from "@/types/schemas/domain";
import { publicFetch } from "@/server/lib/public-fetch";
import type * as UrlPolicy from "@/server/lib/audit/url-policy";
import { verifyWebsite } from "./verifyWebsite";

// Only acme hosts resolve (SafeFetch's DNS policy check).
vi.mock("@/server/lib/audit/url-policy", async (original) => ({
  ...(await original<typeof UrlPolicy>()),
  normalizeAndValidateStartUrl: async (url: string) => {
    if (!new URL(url).hostname.endsWith("acme.com")) throw new Error("dns");
  },
}));
vi.mock("@/server/lib/public-fetch", () => ({ publicFetch: vi.fn() }));

const FULL_NAME =
  "Mozilla/5.0 (compatible; OpenSEO-Handbook/1.0; +https://openseo.so)";
const fetchMock = vi.mocked(publicFetch);
const uaOf = (init?: RequestInit) =>
  new Headers(init?.headers).get("user-agent") ?? "";
const socketClosed = () =>
  new TypeError("fetch failed", {
    cause: Object.assign(new Error("other side closed"), {
      code: "UND_ERR_SOCKET",
    }),
  });
const answer = (status: number, body = "", headers: HeadersInit = {}) =>
  new Response(status >= 300 && status < 400 ? null : body, {
    status,
    headers,
  });

beforeEach(() => {
  fetchMock.mockImplementation(async () => answer(200, "<html></html>"));
});

/** WO-B20-010 / WO-B20-015 (f): hostile Website values never reach a run. */
describe("Check a site website value", () => {
  it.each([
    "exa mple.com",
    "localhost",
    "10.0.0.1",
    "http://192.168.1.1/",
    "acme",
  ])("rejects %s at the schema", (website) => {
    expect(domainField.safeParse(website).success).toBe(false);
  });

  // The reason is returned, not thrown: a thrown AppError reaches the client
  // as its bare code, and the form showed "Please check your input" (run 98).
  it("returns the reason for two hosts glued together (resolves nowhere)", async () => {
    const host = domainField.parse("aircorheatingcooling.comsamanthaco.ca");
    await expect(verifyWebsite(host)).resolves.toEqual({
      ok: false,
      reason:
        "aircorheatingcooling.comsamanthaco.ca does not exist (no DNS record). Check the spelling.",
    });
  });

  it("accepts a site that answers", async () => {
    await expect(verifyWebsite("acme.com")).resolves.toEqual({
      ok: true,
      domain: "acme.com",
    });
  });
});

/** WO-B27-001: evolvedmechanical.com dropped the full app name, answered the short one. */
describe("a site that drops the full app name", () => {
  it("passes when the short app name is answered", async () => {
    fetchMock.mockImplementation(async (_url, init) => {
      if (uaOf(init) === FULL_NAME) throw socketClosed();
      return answer(200, "<html></html>");
    });
    await expect(verifyWebsite("acme.com")).resolves.toEqual({
      ok: true,
      domain: "acme.com",
    });
    expect(uaOf(fetchMock.mock.calls[1]?.[1])).toBe(
      "OpenSEO-Handbook/1.0 (+https://openseo.so)",
    );
  });

  it("never retests a site that answers the full name", async () => {
    await verifyWebsite("acme.com");
    expect(fetchMock.mock.calls.map(([, init]) => uaOf(init))).toEqual([
      FULL_NAME,
      FULL_NAME, // robots.txt
    ]);
  });
});

/** WO-B27-002: each failure says what happened; spelling only for DNS. */
describe("start check reasons", () => {
  const reasonFor = async (impl: typeof publicFetch) => {
    fetchMock.mockImplementation(impl);
    const result = await verifyWebsite("acme.com");
    return result.ok ? null : result.reason;
  };

  it("names a connection the site closes for both names", async () => {
    expect(
      await reasonFor(async () => {
        throw socketClosed();
      }),
    ).toBe(
      "acme.com closed the connection before answering, for the app's full and short crawler names. Its firewall likely blocks automated checks. Trying again will not help until the site changes this.",
    );
  });

  it("names a timeout and says retrying can help", async () => {
    expect(
      await reasonFor(async () => {
        throw new DOMException("timed out", "TimeoutError");
      }),
    ).toBe(
      "acme.com did not answer within 15 seconds. The site may be slow or down. Trying again later can help.",
    );
  });

  it("names a refused connection", async () => {
    const refused = new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect"), { code: "ECONNREFUSED" }),
    });
    expect(
      await reasonFor(async () => {
        throw refused;
      }),
    ).toBe(
      "acme.com refused the connection: nothing answers on HTTPS. Trying again later can help.",
    );
  });

  it("names a certificate problem", async () => {
    const tls = new TypeError("fetch failed", {
      cause: Object.assign(new Error("certificate has expired"), {
        code: "CERT_HAS_EXPIRED",
      }),
    });
    expect(
      await reasonFor(async () => {
        throw tls;
      }),
    ).toBe(
      "acme.com has an HTTPS certificate problem, so the connection was not made (browsers warn too). Trying again will not help until the site changes this.",
    );
  });

  it("names an HTTP error status", async () => {
    expect(await reasonFor(async () => answer(503))).toBe(
      "acme.com answered the home page with HTTP 503 (unavailable). Trying again later can help.",
    );
  });

  it("names a redirect off the site", async () => {
    expect(
      await reasonFor(async () =>
        answer(301, "", { location: "https://acme-new.example/" }),
      ),
    ).toBe(
      "acme.com redirects to acme-new.example. Check acme-new.example instead.",
    );
  });

  it("names a redirect loop", async () => {
    expect(
      await reasonFor(async (url) =>
        answer(302, "", {
          location: String(url).includes("www.")
            ? "https://acme.com/"
            : "https://www.acme.com/",
        }),
      ),
    ).toBe(
      "acme.com redirects in a loop and never reaches a page. Trying again will not help until the site changes this.",
    );
  });

  it("names a robots.txt that disallows the app", async () => {
    expect(
      await reasonFor(async (url) =>
        String(url).endsWith("/robots.txt")
          ? answer(200, "User-agent: *\nDisallow: /")
          : answer(200, "<html></html>"),
      ),
    ).toBe(
      "acme.com's robots.txt does not allow OpenSEO-Handbook to read the home page, and the app obeys it. Trying again will not help unless the site changes its robots.txt.",
    );
  });
});
