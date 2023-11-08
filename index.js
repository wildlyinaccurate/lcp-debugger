import { chromium, devices } from "playwright";
import { initializeObservers } from "./browser/observers.js";

const DEFAULT_OPTIONS = {
  device: "Desktop Chrome",
};

export default async function getLcpData(url, options = {}) {
  options = { ...DEFAULT_OPTIONS, ...options };

  function log(msg) {
    if (options.verbose) {
      process.stdout.write(`${msg}\n`);
    }
  }

  function logError(msg) {
    process.stderr.write(`${msg}\n`);
  }

  const device = devices[options.device];
  const CPU_IDLE_TIME = 500;
  const OBSERVER_COLLECTION_DELAY = 2000;

  log("Launching browser");
  const browser = await chromium.launch({
    headless: false,
  });
  const context = await browser.newContext(device);
  const page = await context.newPage();

  // Keep track of requests
  const requests = [];
  page.on("request", (request) => requests.push(request));

  log(`Opening ${url}`);
  await page.goto(url.toString());
  await page.evaluate(initializeObservers);

  // Allow the page to finish loading
  try {
    log("Waiting for network idle");
    await page.waitForLoadState("networkidle");
  } catch (e) {
    logError("Timed out while waiting for network idle. Continuing anyway...");
  }

  const getLongTaskEntries = async () =>
    page.evaluate(() => __LCP_DEBUGGER.longTaskEntries);

  log("Waiting for CPU idle");
  let longTaskEntries = await getLongTaskEntries();
  await page.waitForTimeout(CPU_IDLE_TIME);
  let newLongTaskEntries = await getLongTaskEntries();
  while (newLongTaskEntries.length > longTaskEntries.length) {
    log("...");
    longTaskEntries = newLongTaskEntries;
    await page.waitForTimeout(CPU_IDLE_TIME);
    newLongTaskEntries = await getLongTaskEntries();
  }

  // Give the PerformanceObserver some time to collect entries
  await page.waitForTimeout(OBSERVER_COLLECTION_DELAY);

  const lcpEntries = await page.evaluate(() => __LCP_DEBUGGER.lcpEntries);
  const lastLcpEntry = lcpEntries[lcpEntries.length - 1];
  log(`Found ${lcpEntries.length} LCP entries`);
  log(`Found ${longTaskEntries.length} long task entries`);

  if (!lastLcpEntry) {
    logError("No LCP element found");
    process.exit(0);
  }

  log("Highlighting LCP element");
  await page.evaluate(() => {
    const lcpEntries = window.__LCP_DEBUGGER.lcpEntries;
    const lastLcpEntry = lcpEntries[lcpEntries.length - 1];
    const lcpRect = lastLcpEntry.element.getBoundingClientRect();

    const shadowDiv = document.createElement("div");
    shadowDiv.style.boxShadow = "0 0 0 99999px rgba(0, 0, 0, 0.5)";
    shadowDiv.style.height = `${lcpRect.height}px`;
    shadowDiv.style.left = `${lcpRect.left}px`;
    shadowDiv.style.position = "absolute";
    shadowDiv.style.top = `${lcpRect.top}px`;
    shadowDiv.style.width = `${lcpRect.width}px`;
    shadowDiv.style.zIndex = "999999";

    const innerShadowDiv = document.createElement("div");
    innerShadowDiv.style.border = "3px solid red";
    innerShadowDiv.style.height = "100%";
    innerShadowDiv.style.width = "100%";

    shadowDiv.appendChild(innerShadowDiv);
    document.body.appendChild(shadowDiv);
    document.body.style.overflow = "hidden";
  });

  log("Taking screenshot");
  await page.screenshot({ path: "screenshot.png" });

  const navEntry = await page.evaluate(
    () => performance.getEntriesByType("navigation")[0]
  );
  const ttfb = navEntry.responseStart;

  log(`TTFB was at ${Math.round(ttfb)} ms`);
  log(`LCP was at ${Math.round(lastLcpEntry.startTime)} ms`);
  log(`LCP URL was ${lastLcpEntry.url}`);

  const lcpRequest = await page.evaluate(
    (lcpEntry) => performance.getEntriesByName(lcpEntry.url)[0],
    lastLcpEntry
  );

  if (lcpRequest) {
    const lcpRequestStart = lcpRequest.requestStart;
    const lcpResponseEnd = lcpRequest.responseEnd;
    const lcpLoadDelay = lcpRequestStart - ttfb;
    const lcpLoadTime = lcpResponseEnd - lcpRequestStart;
    const lcpRenderDelay = lastLcpEntry.startTime - lcpResponseEnd;

    log("LCP sub-parts:");
    log(`  Load delay: ${Math.round(lcpLoadDelay)} ms`);
    log(`  Load time: ${Math.round(lcpLoadTime)} ms`);
    log(`  Render delay: ${Math.round(lcpRenderDelay)} ms`);
    log(`  requestStart: ${Math.round(lcpRequestStart)} ms`);
    log(`  responseEnd: ${Math.round(lcpResponseEnd)} ms`);
  }

  const mainFrameRequests = requests.filter(
    (request) => request.frame() === page.mainFrame() && request.url() !== url
  );

  const logRequest = (request) =>
    log(
      `${request.timing().responseStart} - ${
        request.timing().responseEnd
      } ms - ${request.url()}`
    );

  // log("");
  // log("=====================");
  // log("All requests:");
  // mainFrameRequests.forEach(logRequest);

  log("");
  log("=====================");
  log("Requests that potentially blocked LCP:");
  mainFrameRequests
    .filter((request) => request.timing().responseEnd < lcpEntries[0].startTime)
    .forEach(logRequest);

  log("Cleaning up");
  await context.close();
  await browser.close();

  return {
    lcp: {
      entry: lastLcpEntry,
    },
  };
}
