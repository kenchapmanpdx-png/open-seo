import forkThemeCss from "./fork-theme.css?inline";

/**
 * Fork theme layer (B16 WO-B16-005, ADR-030): token overrides in
 * `fork-theme.css`, switched by `data-fork-look` on <html>. Mounted from
 * `ForkHealthChip.tsx`, so no upstream file changes.
 */
const FORK_LOOKS = ["upstream", "a", "b", "c"] as const;
type ForkLook = (typeof FORK_LOOKS)[number];

/** The look Ken picked (`look_choice` in fork/STATE.md). Rollback: "upstream". */
const FORK_LOOK: ForkLook = "c";

const PREVIEW_KEY = "fork:look-preview";

const isLook = (value: string | null): value is ForkLook =>
  FORK_LOOKS.some((look) => look === value);

type PreviewStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * `?look=a|b|c|upstream` previews a look for this tab (stored in session
 * storage, so it survives in-app navigation); otherwise the stored preview,
 * otherwise `fallback`. Unknown values are ignored.
 */
export function resolveForkLook(
  search: string,
  storage: PreviewStorage | null,
  fallback: ForkLook = FORK_LOOK,
): ForkLook {
  const asked = new URLSearchParams(search).get("look")?.toLowerCase() ?? null;
  try {
    if (isLook(asked)) {
      storage?.setItem(PREVIEW_KEY, asked);
      return asked;
    }
    const stored = storage?.getItem(PREVIEW_KEY) ?? null;
    return isLook(stored) ? stored : fallback;
  } catch {
    // Storage blocked (sandboxed frame): the URL still decides this page.
    return isLook(asked) ? asked : fallback;
  }
}

function sessionStore(): PreviewStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

const STYLE_ID = "fork-theme";

/**
 * Adds the look's token overrides once and sets `data-fork-look` on <html>;
 * call once in the browser.
 */
export function applyForkLook() {
  if (typeof document === "undefined") return;
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = forkThemeCss;
    document.head.appendChild(style);
  }
  const look = resolveForkLook(window.location.search, sessionStore());
  document.documentElement.setAttribute("data-fork-look", look);
}
