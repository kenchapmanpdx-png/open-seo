/**
 * Copy-quality prose capture for the html-facts pass (ADR-023): text of each
 * `<p>` outside header / nav / footer / aside / form / li / td / th /
 * blockquote, whitespace collapsed, with the index of the preceding H2
 * outside landmarks (−1 before the first); ≤ `maxChars` in total.
 */
const NOT_PROSE = new Set([
  "header",
  "nav",
  "footer",
  "aside",
  "form",
  "li",
  "td",
  "th",
  "blockquote",
]);
const LANDMARKS = new Set(["header", "nav", "footer", "aside"]);

export function createProseReader(maxChars: number) {
  const prose: { h2: number; text: string }[] = [];
  let length = 0;
  let h2 = -1;
  let open: { at: number; text: string[] } | null = null;
  return {
    /** Call after the tag is pushed on `stack`. */
    open(name: string, stack: readonly string[]) {
      if (name === "h2" && !stack.some((t) => LANDMARKS.has(t))) h2 += 1;
      if (name === "p" && !open && !stack.some((t) => NOT_PROSE.has(t)))
        open = { at: stack.length, text: [] };
      if (name === "br" && open) open.text.push(" ");
    },
    text(text: string) {
      open?.text.push(text);
    },
    /** Call after the stack is popped. */
    close(stack: readonly string[]) {
      if (!open || open.at <= stack.length) return;
      const text = open.text.join("").replace(/\s+/g, " ").trim();
      if (text && length < maxChars) {
        prose.push({ h2, text });
        length += text.length;
      }
      open = null;
    },
    result: () => prose,
  };
}
