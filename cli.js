#!/usr/bin/env node
import minimist from "minimist";
import log from "npmlog";
import getVitalsData from "./index.js";

const argv = minimist(process.argv.slice(2));

if (!argv._.length || !URL.canParse(argv._[0])) {
  log.stdout(usage());
  process.exit(1);
}

const url = argv._[0];

const DEFAULT_OPTIONS = {
  device: "Desktop Chrome",
  headless: true,
  output: "json",
  outputPath: "stdout",
};

const kebabToCamel = (str) => str.replace(/-./g, (x) => x[1].toUpperCase());
const options = {
  ...DEFAULT_OPTIONS,
  ...Object.fromEntries(Object.entries(argv).map(([k, v]) => [kebabToCamel(k), v])),
};

if (options.headed) {
  options.headless = false;
}

if (options.output !== "json") {
  log.error(`Unknown output type "${options.output}".`);
  process.exit(1);
}

if (options.verbose) {
  log.level = "verbose";
  log.setGaugeTemplate([{ type: "activityIndicator" }]);
} else {
  log.setGaugeTemplate([]);
}

log.info(`Testing ${url}`);

const data = await getVitalsData(url, options);
process.stdout.write(JSON.stringify(data, null, 4));

function usage() {
  return `lcp-debugger <url> <options>

  Logging options:
    --verbose   Display verbose logging

  Output:
    --output        Output format ["json"] [default: "${DEFAULT_OPTIONS.output}"]
    --output-path   The path to write the output to. Use "stdout" to write to stdout. [default: "${DEFAULT_OPTIONS.outputPath}"]

  Configuration:
    --preset            Use one of the preset configurations ["desktop" | "mobile"] [default: "desktop"]
    --device            Use a specific Playwright device configuration (overrides --preset)
    --[no-]headless     Run the browser in headless mode [default: ${DEFAULT_OPTIONS.headless}]
    --headed            Run the browser in headed mode (overrides --headless)
`;
}
