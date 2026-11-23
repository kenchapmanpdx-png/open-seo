/**
 * Raw-HTML text outside hidden subtrees (PageMarkup.visibleText, B19 run 90):
 * error / empty-state templates a theme ships with `class="hidden"` are not
 * page copy (handbook §14, P2-04).
 */
const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

/** Hidden in raw HTML: `hidden`, `aria-hidden`, class `hidden`, inline display:none. */
function isHiddenElement(attrs: Record<string, string>): boolean {
  return (
    "hidden" in attrs ||
    attrs["aria-hidden"] === "true" ||
    /(^|\s)hidden(\s|$)/.test(attrs.class ?? "") ||
    /display\s*:\s*none/i.test(attrs.style ?? "")
  );
}

/** Text outside hidden subtrees; `visibleText` only when something was hidden. */
export function hiddenTextTracker(max: number) {
  let at = 0;
  let hadHidden = false;
  const parts: string[] = [];
  return {
    open(attrs: Record<string, string>, depth: number) {
      if (at === 0 && isHiddenElement(attrs)) at = depth;
    },
    close(depth: number) {
      if (at > depth) at = 0;
    },
    text(text: string) {
      if (at === 0) parts.push(text);
      else hadHidden ||= text.trim() !== "";
    },
    result(): { visibleText?: string } {
      return hadHidden
        ? { visibleText: collapse(parts.join(" ")).slice(0, max) }
        : {};
    },
  };
}
