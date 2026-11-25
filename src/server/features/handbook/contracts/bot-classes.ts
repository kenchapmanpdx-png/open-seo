import type { BotName } from "./collectors";

/**
 * WO-B21-004: every bot in `BOT_USER_AGENTS` is a search crawler (its block
 * can stop indexing: S1) or an AI crawler (a block cannot: S2). Additive;
 * the type below fails `types:check` when a bot has no class.
 */
export const SEARCH_BOTS = ["Googlebot", "Bingbot"] as const;
export const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ClaudeBot",
  "PerplexityBot",
] as const;
type Classified = (typeof SEARCH_BOTS)[number] | (typeof AI_BOTS)[number];
// Both directions: no unclassified bot, no class entry that is not a bot.
const everyBotClassified: [BotName] extends [Classified]
  ? [Classified] extends [BotName]
    ? true
    : never
  : never = true;
void everyBotClassified;
