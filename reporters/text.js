export function textReporter(data) {
  const { ttfb, lcp } = data;
  const output = [
    `TTFB: ${Math.round(ttfb.startTime)} ms`,
    `LCP: ${Math.round(lcp.startTime)} ms (${lcp.url})`,
    "",

    "LCP sub-parts:",
    `  Load delay: ${Math.round(lcp.subParts.loadDelay)} ms`,
    `  Load time: ${Math.round(lcp.subParts.loadTime)} ms`,
    `  Render delay: ${Math.round(lcp.subParts.renderRelay)} ms`,
    "",

    `Found ${lcp.optimizations.blockingResources.length} resources that potentially blocked LCP:`,
    ...lcp.optimizations.blockingResources.map(
      (request) => `  - ${request.url} (${request.savings} ms potential savings)`,
    ),

    "",
  ];

  process.stdout.write(output.join("\n"));
}
