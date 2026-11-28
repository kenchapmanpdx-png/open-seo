/**
 * Text-level (inline) tags: the browser prints the text either side of them
 * with no gap, so `Zebra<span>Thrive</span>` reads "ZebraThrive" and
 * `1<sup>st</sup>` "1st" (WO-B26-007). Every other tag is an element boundary
 * and adds a space. A utility class that makes one of these a box (Tailwind
 * `block`, Bootstrap `d-block`), or a flex / grid parent (which blockifies
 * its children), makes it a boundary too.
 */
const INLINE = new Set(
  "span abbr b bdi bdo cite code data dfn em i kbd mark q s samp small strong sub sup time u var font del ins wbr".split(
    " ",
  ),
);
const BOX_CLASS =
  /^(?:[\w-]+:)?(?:block|flex|grid|table|list-item|flow-root)$|^d-(?:\w+-)?(?:block|flex|grid|table)$/;
const FLEX_CLASS =
  /^(?:[\w-]+:)?(?:inline-)?(?:flex|grid)$|^d-(?:\w+-)?(?:inline-)?(?:flex|grid)$/;

/**
 * Text runs of one parse. A run = the text between two tags: htmlparser2
 * emits a decoded character reference (`&#x27;`, `&amp;`) and the text either
 * side of a comment (React's `a<!-- -->b`) as separate chunks; they join with
 * no separator so `what&#x27;s` reads `what's` (WO-B26-001). A run that
 * follows an element boundary starts with a space. `open` / `close` mirror the
 * parser's element stack (`close(at)` = the stack is cut back to `at`);
 * `open` and `end` hand the finished run to `onRun`.
 */
export function createTextRuns(onRun: (text: string) => void) {
  let chunks: string[] = [];
  /** A boundary passed since the last run: the next run starts with a space. */
  let gap = false;
  const boxes: { boundary: boolean; flex: boolean }[] = [];
  const end = () => {
    if (chunks.length === 0) return;
    const text = (gap ? " " : "") + chunks.join("");
    chunks = [];
    gap = false;
    onRun(text);
  };
  return {
    open(name: string, classAttr: string | undefined) {
      end();
      const classes = (classAttr ?? "").split(/\s+/);
      const boundary =
        !INLINE.has(name) ||
        boxes.at(-1)?.flex === true ||
        classes.some((c) => BOX_CLASS.test(c));
      boxes.push({ boundary, flex: classes.some((c) => FLEX_CLASS.test(c)) });
      gap ||= boundary;
    },
    /** Returns `at`, the new stack depth. */
    close(at: number) {
      gap ||= boxes.slice(at).some((b) => b.boundary);
      boxes.length = at;
      return at;
    },
    push(text: string) {
      chunks.push(text);
    },
    /** Hands the pending run, if any, to `onRun`. */
    end,
  };
}
