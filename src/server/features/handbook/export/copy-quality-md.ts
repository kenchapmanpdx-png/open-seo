import {
  COPY_QUALITY_TOP,
  copyThresholds,
  type CopyQuality,
} from "@/server/features/handbook/contracts/scaled-copy";

const cell = (text: string) =>
  text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

/** §4.4: label line, site medians, then the top pages by `overCount`. */
export function copyQualityMd(section: CopyQuality): string[] {
  const thresholds = copyThresholds(section);
  const measured = section.pages.flatMap((p) => (p.measured ? [p] : []));
  return [
    "## Copy quality (not scored)",
    "",
    section.label,
    "",
    `${measured.length}/${section.pages.length} pages measured.`,
    "",
    "| Metric | Site median | Threshold |",
    "| --- | --- | --- |",
    ...section.medians.map(
      (m) =>
        `| ${m.id} | ${m.value ?? "n/a"} | ${thresholds.get(m.id) ?? "number only"} |`,
    ),
    "",
    "| URL | Template | Prose words | Over | Metrics over |",
    "| --- | --- | --- | --- | --- |",
    ...measured.slice(0, COPY_QUALITY_TOP).map(
      (p) =>
        `| ${cell(p.url)} | ${cell(p.template ?? "")} | ${p.proseWords} | ${p.overCount} | ${p.metrics
          .filter((m) => m.over)
          .map((m) => m.id)
          .join(", ")} |`,
    ),
    "",
  ];
}
