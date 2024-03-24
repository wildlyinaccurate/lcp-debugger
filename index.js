import log from "npmlog";
import { chromium, devices } from "playwright";
import { highlightArea } from "./browser/highlight.js";
import { initializeObservers } from "./browser/observer.js";

/**
 * @param {string} url
 * @param {Object} options
 * @param {string} options.device
 * @param {boolean=} options.headless
 * @returns {Object<string, Object>}
 */
export default async function getVitalsData(url, options = {}) {
  const CPU_IDLE_TIME = 1000;
  const OBSERVER_COLLECTION_DELAY = 500;

  log.verbose(`Launching browser with '${options.device}' device`);
  const browser = await chromium.launch({
    headless: options.headless,
  });
  const context = await browser.newContext(devices[options.device]);
  const page = await context.newPage();

  // Keep track of requests
  const requests = [];
  page.on("request", (request) => requests.push(request));

  log.verbose(`Opening ${url}`);
  await page.goto(url.toString());

  log.verbose("Attaching observers");
  const observer = await initializeObservers(page);

  // Allow the page to finish loading
  try {
    log.verbose("Waiting for network idle");
    await page.waitForLoadState("networkidle");
  } catch (e) {
    log.error("Timed out while waiting for network idle. Continuing anyway...");
  }

  log.enableProgress();
  log.verbose("Waiting for CPU idle");
  let now = await page.evaluate(() => performance.now());
  let lastTaskTime = 0;
  observer.on("longtask", (entry) => (lastTaskTime = entry.startTime + entry.duration));

  while (now - CPU_IDLE_TIME < lastTaskTime) {
    log.gauge.pulse();
    await page.waitForTimeout(100);
    now = await page.evaluate(() => performance.now());
  }
  log.disableProgress();

  // Give the PerformanceObserver some time to collect entries
  await page.waitForTimeout(OBSERVER_COLLECTION_DELAY);

  const lcpEntries = observer.getEntries("largest-contentful-paint");
  const lcpEntry = lcpEntries[lcpEntries.length - 1];
  log.verbose(`Found ${lcpEntries.length} LCP entries`);

  if (!lcpEntry) {
    log.error("No LCP element found");
    process.exit(0);
  }

  log.verbose("Highlighting LCP element");
  await highlightArea(page, lcpEntry.rect);

  log.verbose("Taking screenshot");
  await page.screenshot({ path: "screenshot.png", fullPage: true });

  const navEntry = await page.evaluate(() => performance.getEntriesByType("navigation")[0]);
  const ttfb = navEntry.responseStart;

  log.verbose(`TTFB was at ${Math.round(ttfb)} ms`);
  log.verbose(`LCP was at ${Math.round(lcpEntry.startTime)} ms`);
  log.verbose(`LCP URL was ${lcpEntry.url}`);

  const lcpRequest = await page.evaluate(
    (lcpEntry) => performance.getEntriesByName(lcpEntry.url)[0],
    lcpEntry,
  );

  const lcpSubParts = {
    ttfb,
    loadDelay: undefined,
    loadTime: undefined,
    renderDelay: undefined,
  };

  if (lcpRequest) {
    const lcpRequestStart = lcpRequest.requestStart;
    const lcpResponseEnd = lcpRequest.responseEnd;
    lcpSubParts.loadDelay = lcpRequestStart - ttfb;
    lcpSubParts.loadTime = lcpResponseEnd - lcpRequestStart;
    lcpSubParts.renderRelay = lcpEntry.startTime - lcpResponseEnd;

    log.verbose("LCP sub-parts:");
    log.verbose(`  Load delay: ${Math.round(lcpSubParts.loadDelay)} ms`);
    log.verbose(`  Load time: ${Math.round(lcpSubParts.loadTime)} ms`);
    log.verbose(`  Render delay: ${Math.round(lcpSubParts.renderRelay)} ms`);
    log.verbose(`  requestStart: ${Math.round(lcpRequestStart)} ms`);
    log.verbose(`  responseEnd: ${Math.round(lcpResponseEnd)} ms`);
  }

  const mainFrameRequests = requests.filter(
    (request) => request.frame() === page.mainFrame() && request.url() !== url,
  );

  const lcpBlockingResources = mainFrameRequests.filter((request) => {
    const timing = request.timing();
    const requestIsNotLCP = request.url() !== lcpEntry.url;
    const requestStartedBeforeLCP = timing.responseEnd < lcpEntries[0].startTime;
    const requestWasNotCached = timing.responseEnd - timing.requestStart > 0;

    return requestIsNotLCP && requestStartedBeforeLCP && requestWasNotCached;
  });

  log.verbose(`Found ${mainFrameRequests.length} HTTP requests in the main frame`);
  log.verbose(`Found ${lcpBlockingResources.length} HTTP requests that potentially blocked LCP`);

  log.verbose("Cleaning up");
  await context.close();
  await browser.close();

  return {
    ttfb: {
      time: ttfb,
      startTime: ttfb,
    },
    lcp: {
      time: lcpEntry.startTime,
      startTime: lcpEntry.startTime,
      renderTime: lcpEntry.renderTime,
      loadTime: lcpEntry.loadTime,
      url: lcpEntry.url,
      name: lcpEntry.name,
      fetchPriority: lcpEntry.fetchPriority,
      preloaded: lcpEntry.preloaded,
      rect: lcpEntry.rect,
      subParts: lcpSubParts,
      optimizations: {
        blockingResources: lcpBlockingResources.map((request) => {
          const timing = request.timing();

          return {
            url: request.url(),
            timing,
            savings: Math.round(timing.responseEnd - timing.requestStart),
          };
        }),
      },
    },
    requests: mainFrameRequests,
  };
}
