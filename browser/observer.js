import { nanoid } from "nanoid";

export async function initializeObservers(page) {
  const contextId = nanoid();
  const listeners = {};
  const entries = {};
  const addEntry = (type, entry) => {
    if (typeof entries[type] === "undefined") {
      entries[type] = [];
    }

    entries[type].push(entry);

    if (listeners[type]) {
      listeners[type].forEach((listener) => listener(entry));
    }
  };

  await page.exposeBinding(`${contextId}_addEntry`, (source, type, entry) => {
    addEntry(type, entry);
  });

  await page.evaluate((addEntryFn) => {
    const observe = (type, transformer) => {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (transformer) {
            entry = transformer(entry);
          }

          window[addEntryFn](type, entry);
        });
      }).observe({
        type,
        buffered: true,
      });
    };

    observe("layout-shift");
    observe("long-animation-frame");
    observe("longtask");

    observe("largest-contentful-paint", (entry) => {
      const preloaded =
        entry.url &&
        [...document.getElementsByTagName("link")]
          .filter((link) => link.rel === "preload" && link.as === "image")
          .some((link) => link.href === entry.url);

      return {
        ...entry.toJSON(),
        rect: entry.element.getBoundingClientRect(),
        fetchPriority: entry.element.fetchPriority,
        preloaded,
      };
    });
  }, `${contextId}_addEntry`);

  return {
    on(type, cb) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(cb);

      if (entries[type]) {
        entries[type].forEach(cb);
      }
    },

    getEntries(type) {
      return entries[type] || [];
    },
  };
}
