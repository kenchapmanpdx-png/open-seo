import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import type { ReportJson } from "@/server/features/handbook/contracts/exports";

type Unread = NonNullable<NonNullable<ReportJson["run"]["coverage"]>["unread"]>;

const CLASS_LABEL: Record<Unread["rows"][number]["class"], string> = {
  redirect: "Redirect",
  "404": "Not found / error",
  attachment: "Attachment page",
  "non-HTML": "Not a web page (file)",
  unseen: "Not reached",
};

/** "Pages not read" (ACCURACY #0): crawled URLs this run did not read, collapsed. */
export function UnreadPagesTable({
  unread,
  capped,
}: {
  unread: Unread;
  capped: boolean;
}) {
  if (unread.total === 0) return null;
  const counts = Object.entries(unread.byClass)
    .map(([cls, n]) => `${CLASS_LABEL[cls as keyof typeof CLASS_LABEL]} ${n}`)
    .join(" · ");
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">
        Pages not read ({unread.total}) — {counts}
      </summary>
      <div className="mt-2 space-y-2">
        {capped ? (
          <p className="text-xs text-muted-foreground">
            The page limit for this run stopped the crawl; &ldquo;Not
            reached&rdquo; pages were left for that reason.
          </p>
        ) : null}
        {unread.rows.length < unread.total ? (
          <p className="text-xs text-muted-foreground">
            Showing {unread.rows.length} of {unread.total}.
          </p>
        ) : null}
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page</TableHead>
                <TableHead>Why not read</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Goes to</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unread.rows.map((r) => (
                <TableRow key={r.url}>
                  <TableCell className="max-w-md truncate">{r.url}</TableCell>
                  <TableCell>{CLASS_LABEL[r.class]}</TableCell>
                  <TableCell>{r.status ?? "—"}</TableCell>
                  <TableCell className="max-w-md truncate">
                    {r.target ?? ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      </div>
    </details>
  );
}
