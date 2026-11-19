import { describe, expect, it } from "vitest";
import { detectInterstitial, smallBodyHashTracker } from "./interstitial";

const URL_ = "https://example.com/";
const page = (head: string, body: string) =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

const VENDORS: [string, string, [string, string][]][] = [
  [
    "openresty",
    page(
      "<title>One moment, please...</title>",
      "<h1>Please wait while your request is being verified...</h1><script>setTimeout(()=>location.reload(),5000)</script>",
    ),
    [["server", "openresty"]],
  ],
  [
    "cloudflare",
    page(
      "<title>Just a moment...</title>",
      '<script src="/cdn-cgi/challenge-platform/h/g/orchestrate/chl_page/v1"></script>',
    ),
    [["cf-mitigated", "challenge"]],
  ],
  [
    "imunify360",
    page(
      "<title>Captcha</title>",
      "<p>Imunify360 bot-protection: please confirm you are human.</p>",
    ),
    [],
  ],
  [
    "sucuri",
    page(
      "<title>Sucuri WebSite Firewall - Access Denied</title>",
      "<p>Access Denied - Sucuri Website Firewall</p>",
    ),
    [["x-sucuri-id", "18015"]],
  ],
  [
    "akamai",
    page(
      "<title>Access Denied</title>",
      "<p>You don't have permission to access this server.</p><p>Reference #18.2f1e3b17.1731700000.5a6b7c</p>",
    ),
    [["server", "AkamaiGHost"]],
  ],
  [
    "incapsula",
    page("", '<iframe src="/_Incapsula_Resource?CWUDNSAI=9&xinfo=1"></iframe>'),
    [],
  ],
  [
    "datadome",
    page("", "<script>var dd={'host':'geo.captcha-delivery.com'}</script>"),
    [["x-datadome", "protected"]],
  ],
  [
    "perimeterx",
    page(
      "<title>Access to this page has been denied</title>",
      '<div id="px-captcha"></div>',
    ),
    [],
  ],
  [
    "aws-waf",
    page("", '<script src="https://x.token.awswaf.com/challenge.js"></script>'),
    [["x-amzn-waf-action", "challenge"]],
  ],
];

describe("detectInterstitial", () => {
  it.each(VENDORS)("detects %s", (vendor, body, headers) => {
    expect(detectInterstitial(body, headers, URL_)).toEqual({
      vendor,
      rule: "vendor",
    });
  });

  it("flags a 39-word reload page without a canonical as generic", () => {
    const body = page(
      "<title>Checking</title>",
      `<p>${words(39)}</p><script>location.reload()</script>`,
    );
    expect(detectInterstitial(body, [], URL_)).toEqual({
      vendor: null,
      rule: "generic",
    });
  });

  it("leaves a normal short page with a canonical alone", () => {
    const body = page(
      `<title>Contact</title><link rel="canonical" href="${URL_}">`,
      `<p>${words(30)}</p><script>location.reload()</script>`,
    );
    expect(detectInterstitial(body, [], URL_)).toBeNull();
  });

  it("ignores a vendor script injected into a full page", () => {
    const body = page(
      "<title>Home</title>",
      `<p>${words(9000)}</p><script src="/_Incapsula_Resource?SWJIYLWA=1"></script>`,
    );
    expect(detectInterstitial(body, [], URL_)).toBeNull();
  });
});

describe("smallBodyHashTracker", () => {
  it("reports a small body repeated on 3 distinct URLs", () => {
    const tracker = smallBodyHashTracker();
    for (const path of ["/a", "/b", "/c"]) tracker.add(path, 1024, "same");
    tracker.add("/d", 1024, "other");
    tracker.add("/a", 1024, "other");
    expect(tracker.repeated()).toEqual(new Set(["same"]));
  });
});
