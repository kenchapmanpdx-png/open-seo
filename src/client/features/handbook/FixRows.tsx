import { useState } from "react";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import type { Finding, FixRow as FixRowData } from "./fixList";
import { AI_JUDGED, SEVERITY_LABELS, STATUS_LABELS } from "./labels";

/** Fix List rows (B14 WO-B14-003; merged rows B16 WO-B16-004). */
const PAGE_PREVIEW = 20;
const DETAIL_PREVIEW = 5;

export function FixRow({
  finding: f,
  done,
  onDone,
}: {
  finding: Finding;
  done: boolean;
  onDone: (checked: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <Checkbox
          className="mt-1"
          checked={done}
          onCheckedChange={(checked) => onDone(checked)}
          aria-label={`Mark "${f.title}" done`}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1">
            {(f.categories ?? []).map((c) => (
              <Badge key={c} variant="outline">
                {c}
              </Badge>
            ))}
            {f.source === "llm" ? (
              <Badge variant="secondary" title={AI_JUDGED.help}>
                {AI_JUDGED.label}
              </Badge>
            ) : null}
          </div>
          <div
            className={
              done ? "text-muted-foreground line-through" : "font-medium"
            }
          >
            {f.title}
          </div>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {f.urls.length === 1 ? "1 page" : `${f.urls.length} pages`}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Show"}
        </Button>
      </div>
      {open ? <FixDetail finding={f} /> : null}
    </div>
  );
}

/** Same-title findings as one row; each keeps its own sub-row (WO-B16-004). */
export function MergedFixRow({
  row,
  doneCodes,
  onDone,
}: {
  row: FixRowData;
  doneCodes: ReadonlySet<string>;
  onDone: (codes: string[], checked: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const pages = new Set(row.findings.flatMap((f) => f.urls)).size;
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <Checkbox
          className="mt-1"
          checked={row.done}
          onCheckedChange={(checked) =>
            onDone(
              row.findings.map((f) => f.code),
              checked,
            )
          }
          aria-label={`Mark all "${row.title}" done`}
        />
        <div
          className={`min-w-0 flex-1 ${row.done ? "text-muted-foreground line-through" : "font-medium"}`}
        >
          {row.title}
        </div>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {row.findings.length} page groups ·{" "}
          {pages === 1 ? "1 page" : `${pages} pages`}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Show"}
        </Button>
      </div>
      {open ? (
        <div className="mt-3 space-y-2 pl-7">
          {row.findings.map((f) => (
            <FixRow
              key={f.code}
              finding={f}
              done={doneCodes.has(f.code)}
              onDone={(checked) => onDone([f.code], checked)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FixDetail({ finding: f }: { finding: Finding }) {
  const [allPages, setAllPages] = useState(false);
  const [allDetail, setAllDetail] = useState(false);
  const pages = allPages ? f.urls : f.urls.slice(0, PAGE_PREVIEW);
  // `detail` often lists one line per page; keep the row short.
  const detailLines = f.detail.split("\n");
  const detail = allDetail
    ? f.detail
    : detailLines.slice(0, DETAIL_PREVIEW).join("\n");
  return (
    <div className="mt-3 space-y-3 pl-7 text-sm">
      <div>
        <div className="font-medium">Why it matters</div>
        <p className="whitespace-pre-line text-muted-foreground">{detail}</p>
        {detailLines.length > DETAIL_PREVIEW && !allDetail ? (
          <Button size="sm" variant="link" onClick={() => setAllDetail(true)}>
            Show all {detailLines.length} lines
          </Button>
        ) : null}
      </div>
      <div>
        <div className="font-medium">How to fix</div>
        <p className="whitespace-pre-line">{f.fix}</p>
        {f.limitedReason ? (
          <p className="text-muted-foreground">
            {STATUS_LABELS.LIMITED.label}: {f.limitedReason}
          </p>
        ) : null}
      </div>
      {f.urls.length ? (
        <div>
          <div className="font-medium">Pages</div>
          <ul className="space-y-0.5">
            {pages.map((url) => (
              <li key={url} className="truncate">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
          {f.urls.length > PAGE_PREVIEW && !allPages ? (
            <Button size="sm" variant="link" onClick={() => setAllPages(true)}>
              Show all {f.urls.length}
            </Button>
          ) : null}
        </div>
      ) : null}
      <details>
        <summary className="cursor-pointer text-muted-foreground">
          Details
        </summary>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div>
            <span className="font-mono">{f.code}</span> ·{" "}
            {SEVERITY_LABELS[f.severity].label} ({f.severity}) · effort{" "}
            {f.effort} · items{" "}
            <span className="font-mono">{f.itemIds.join(", ")}</span>
          </div>
          {f.evidence.map((e, i) => (
            <div key={`${e.url}-${i}`}>
              {e.kind}:{" "}
              <a
                href={e.url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {e.url}
              </a>
              {e.excerpt ? ` — ${e.excerpt}` : null}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
