/**
 * Text matching that ignores whitespace, case and typography (WO-B19-014,
 * WO-B26-001): pages print curly apostrophes, dashes and no-break spaces,
 * models and JSON-LD write them straight, and CSS may upper-case a heading
 * the text stores in mixed case.
 */
export const foldText = (s: string) =>
  s
    .normalize("NFKC")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
