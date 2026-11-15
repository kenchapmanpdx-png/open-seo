import { Line, LineChart } from "recharts";
import {
  ChartGrid,
  ChartXAxis,
  ChartYAxis,
} from "@/client/components/ChartAxes";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/client/components/ui/chart";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";

// Presentational pieces of the Bing tab (BingPage.tsx).

const trafficChartConfig = {
  clicks: { label: "Clicks", color: "#2563eb" },
  impressions: { label: "Impressions", color: "#e69f00" },
} satisfies ChartConfig;

export function TrafficChart({
  traffic,
}: {
  traffic: Array<{ day: string; clicks: number; impressions: number }>;
}) {
  return (
    <>
      {traffic.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data synced yet.</p>
      ) : (
        <ChartContainer
          config={trafficChartConfig}
          className="h-56"
          aria-label="Bing clicks and impressions"
        >
          <LineChart data={traffic}>
            <ChartGrid />
            <ChartXAxis dataKey="day" />
            <ChartYAxis yAxisId="left" />
            <ChartYAxis yAxisId="right" orientation="right" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              yAxisId="left"
              dataKey="clicks"
              stroke="var(--color-clicks)"
              dot={false}
            />
            <Line
              yAxisId="right"
              dataKey="impressions"
              stroke="var(--color-impressions)"
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      )}
    </>
  );
}

export function SimpleTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column, index) => (
              <TableHead
                key={column}
                className={index === 0 ? undefined : "text-right"}
              >
                {index === 0 ? title : column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="text-muted-foreground"
              >
                None yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.join("\u0000")}>
                {row.map((cell, index) => (
                  <TableCell
                    key={columns[index]}
                    className={
                      index === 0
                        ? "max-w-96 truncate"
                        : "text-right tabular-nums"
                    }
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableCard>
  );
}
