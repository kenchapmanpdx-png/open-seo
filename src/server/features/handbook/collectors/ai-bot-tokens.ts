import { BOT_USER_AGENTS } from "@/server/features/handbook/contracts/collectors";

/**
 * AI / search crawler tokens for the bot policy map (FULL-READ §3.9,
 * WO-B9-028): each token's robots.txt verdict ("stated") is compared with
 * what the home page serves its user agent ("served"). Fork constant list;
 * UA strings follow each vendor's published form (version numbers vary).
 */
export const AI_BOT_TOKENS: ReadonlyArray<{
  token: string;
  userAgent: string;
}> = [
  { token: "GPTBot", userAgent: BOT_USER_AGENTS.GPTBot },
  { token: "OAI-SearchBot", userAgent: BOT_USER_AGENTS["OAI-SearchBot"] },
  {
    token: "ChatGPT-User",
    userAgent:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
  },
  { token: "ClaudeBot", userAgent: BOT_USER_AGENTS.ClaudeBot },
  {
    token: "Claude-User",
    userAgent:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)",
  },
  {
    token: "Claude-SearchBot",
    userAgent:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +Claude-SearchBot@anthropic.com)",
  },
  {
    token: "anthropic-ai",
    userAgent:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; anthropic-ai/1.0; +http://www.anthropic.com/bot.html)",
  },
  { token: "PerplexityBot", userAgent: BOT_USER_AGENTS.PerplexityBot },
  {
    token: "Perplexity-User",
    userAgent:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)",
  },
  // Google-Extended / Applebot-Extended are robots-only tokens: the
  // crawl itself arrives as Googlebot / Applebot, so their UA is that one.
  { token: "Googlebot", userAgent: BOT_USER_AGENTS.Googlebot },
  { token: "Google-Extended", userAgent: BOT_USER_AGENTS.Googlebot },
  { token: "Bingbot", userAgent: BOT_USER_AGENTS.Bingbot },
  {
    token: "Applebot",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)",
  },
  {
    token: "Applebot-Extended",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)",
  },
  {
    token: "Amazonbot",
    userAgent:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1; +https://developer.amazon.com/support/amazonbot) Chrome/119.0.6045.214 Safari/537.36",
  },
  { token: "CCBot", userAgent: "CCBot/2.0 (https://commoncrawl.org/faq/)" },
  {
    token: "Bytespider",
    userAgent:
      "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)",
  },
  {
    token: "meta-externalagent",
    userAgent:
      "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
  },
  {
    token: "DuckAssistBot",
    userAgent: "DuckAssistBot/1.2; (+http://duckduckgo.com/duckassistbot.html)",
  },
  {
    token: "MistralAI-User",
    userAgent:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-User/1.0; +https://docs.mistral.ai/robots)",
  },
  {
    token: "cohere-ai",
    userAgent: "Mozilla/5.0 (compatible; cohere-ai/1.0; +https://cohere.com/)",
  },
];
