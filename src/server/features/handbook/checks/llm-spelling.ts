/** Entity-test spelling claims (WO-B26-007): exact-print check of the quotes. */
const exact = (t: string) => t.replace(/\s+/g, " ").trim();

/** Two different quotes, each printed exactly on the page it cites. */
function spellingShown(
  quotes: readonly { url: string; text: string }[],
  views: readonly { url: string; text: string }[],
) {
  const shown = quotes.filter((q) =>
    views.some((v) => v.url === q.url && exact(v.text).includes(exact(q.text))),
  );
  return new Set(shown.map((q) => exact(q.text))).size >= 2;
}

/** A fail whose rationale starts "Spelling:" without two exact quotes. */
export function spellingUnshown(
  result: {
    verdict: string;
    rationale: string;
    quotes: readonly { url: string; text: string }[];
  },
  views: readonly { url: string; text: string }[],
) {
  return (
    result.verdict === "fail" &&
    /^spelling\b/i.test(result.rationale.trim()) &&
    !spellingShown(result.quotes, views)
  );
}
