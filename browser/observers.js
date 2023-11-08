export function initializeObservers() {
  window.__LCP_DEBUGGER = {
    layoutShifts: [],
    lcpEntries: [],
    loafEntries: [],
    longTaskEntries: [],
  };

  const observe = (type, bufferName) => {
    new PerformanceObserver((list) =>
      window.__LCP_DEBUGGER[bufferName].push(...list.getEntries())
    ).observe({
      type,
      buffered: true,
    });
  };

  observe("largest-contentful-paint", "lcpEntries");
  observe("layout-shift", "layoutShifts");
  observe("long-animation-frame", "loafEntries");
  observe("longtask", "longTaskEntries");
}
