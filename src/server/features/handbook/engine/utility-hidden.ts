/**
 * Screen bands of the Tailwind / Bootstrap breakpoints (WO-B26-003); Bootstrap
 * `xxl` is read as `2xl`. Utility classes hide an element from a band upward
 * (`md:hidden`, `d-md-none`), below one (`max-lg:hidden`), or from the base
 * band until a display class shows it again (`hidden md:block`,
 * `d-none d-md-block`). The rules sit in an external stylesheet the check
 * does not fetch, so the class names are the evidence.
 */
export const SCREENS = ["base", "sm", "md", "lg", "xl", "2xl"];
const TW_DISPLAY =
  "block|flex|grid|inline|inline-block|inline-flex|inline-grid|table|contents";
const BS_DISPLAY =
  "block|flex|grid|inline|inline-block|inline-flex|inline-grid|table|table-cell|table-row";
const TW_AT = new RegExp(`^(sm|md|lg|xl|2xl):(hidden|${TW_DISPLAY})$`);
const TW_BELOW = /^max-(sm|md|lg|xl|2xl):hidden$/;
const BS_AT = new RegExp(`^d-(sm|md|lg|xl|xxl)-(none|${BS_DISPLAY})$`);
const screenOf = (bp: string) => SCREENS.indexOf(bp === "xxl" ? "2xl" : bp);

/** Bands a class list hides its element in; [] when it hides none. */
export function utilityHiddenBands(classes: readonly string[]): string[] {
  // shownFrom[i]: the display state a class sets from band i upward.
  const shownFrom: (boolean | undefined)[] = SCREENS.map(() => undefined);
  const below: number[] = [];
  let hides = false;
  for (const c of classes) {
    if (c === "hidden" || c === "d-none") {
      shownFrom[0] = false;
      hides = true;
      continue;
    }
    const at = TW_AT.exec(c) ?? BS_AT.exec(c);
    if (at) {
      const hide = at[2] === "hidden" || at[2] === "none";
      shownFrom[screenOf(at[1])] = !hide;
      hides ||= hide;
      continue;
    }
    const max = TW_BELOW.exec(c);
    if (max) {
      below.push(screenOf(max[1]));
      hides = true;
    }
  }
  if (!hides) return [];
  let shown = true;
  return SCREENS.filter((_, i) => {
    shown = shownFrom[i] ?? shown;
    return !shown || below.some((b) => i < b);
  });
}
