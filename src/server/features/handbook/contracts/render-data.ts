/**
 * K2 collector outputs fed by the render sidecar (render, axe, Lighthouse) and
 * the engine-side additions around them (media sizes, CrUX field data). Split
 * from `collectors.ts` in 1.5.1 to keep that file under the line limit;
 * `CollectedData` there references these types.
 */

export type RenderData = {
  pages: ReadonlyArray<{
    url: string;
    js: {
      finalUrl: string;
      status: number | null;
      renderedKey: string;
      words: number;
      requests: ReadonlyArray<{
        url: string;
        resourceType: string;
        status: number | null;
        /** Started before the load event (Resource Timing); absent from older sidecars. 1.1.0 */
        beforeLoad?: boolean;
        /** Bytes over the wire (Resource Timing `transferSize`, else body size). 1.5.0 */
        transferBytes?: number | null;
        /** Recorded then aborted by the sidecar (beacon or media). 1.5.0 */
        aborted?: "beacon" | "media" | null;
        /** Resource Timing `nextHopProtocol` (h2, h3, http/1.1). 1.5.0 */
        protocol?: string | null;
      }>;
      /** Σ transferBytes + declared size of media that loads with the page. 1.5.0 */
      pageWeightBytes?: number | null;
      /** Rendered `<video>` / video iframe layout facts (FULL-READ §3.12). 1.5.0 */
      mediaElements?: ReadonlyArray<RenderedMediaElement>;
      /** Same-host links present only in the rendered DOM (second crawl pass). 1.5.0 */
      renderOnlyLinks?: readonly string[];
      opacityZeroWords: number;
      /** `<form>` count in the rendered DOM (P2-08 JS-only forms). 1.3.0 */
      forms?: number;
      /**
       * Numbers that differ between raw and rendered text at the same context
       * (SUPP-04: prices / counts rewritten by JS). Computed by the engine from
       * both bodies; checks cannot read stored bodies. 1.5.1
       */
      numericMismatches?: ReadonlyArray<{
        raw: string;
        rendered: string;
        context: string;
      }>;
      firstScreenActions: ReadonlyArray<{
        tag: string;
        text: string;
        href: string | null;
      }>;
    };
    noJs: {
      status: number | null;
      nojsKey: string;
      words: number;
      /** Words at opacity:0 with JavaScript off (K3 field of the no-JS render). 1.6.0 */
      opacityZeroWords?: number;
    };
    firstScreenKey: string | null;
    consoleErrors: readonly string[];
  }>;
  /**
   * Size of each media URL seen on rendered pages, from HEAD or a 1-byte
   * Range request (engine-side; the sidecar aborts media bodies). 1.5.1
   */
  mediaSizes?: ReadonlyArray<{
    url: string;
    bytes: number | null;
    method: "head" | "range" | "unknown";
  }>;
};

/** One `<video>` or video `<iframe>` after render. 1.5.0 */
export type RenderedMediaElement = {
  kind: "video" | "iframe";
  src: string | null;
  /** Intersects the first mobile viewport. */
  firstScreen: boolean;
  /** Has width/height attributes or a computed `aspect-ratio` (no layout shift). */
  reservedSize: boolean;
};

export type AxeData = {
  pages: ReadonlyArray<{
    url: string;
    violations: ReadonlyArray<{
      id: string;
      impact: "minor" | "moderate" | "serious" | "critical" | null;
      help: string;
      nodes: number;
      sampleTargets: readonly string[];
      /** Visible text of the sample nodes, ≤120 chars each, same order (P8-02). 1.3.0 */
      sampleTexts?: readonly string[];
    }>;
  }>;
};

export type LighthouseData = {
  pages: ReadonlyArray<{
    url: string;
    formFactor: "mobile" | "desktop";
    environment: string;
    performance: number | null;
    lcpMs: number | null;
    cls: number | null;
    tbtMs: number | null;
    lcpElement: string | null;
    storageKey: string | null;
    /** Lighthouse `render-blocking-resources` items (P7-05). 1.3.0 */
    renderBlocking?: ReadonlyArray<{ url: string; wastedMs: number }>;
  }>;
  /**
   * CrUX field data (p75), url = null for the origin record. Absent when no
   * CrUX key is configured; a row with all-null metrics = no CrUX data. 1.5.1
   */
  field?: ReadonlyArray<{
    url: string | null;
    formFactor: "PHONE" | "DESKTOP";
    lcpMs: number | null;
    cls: number | null;
    inpMs: number | null;
  }>;
};
