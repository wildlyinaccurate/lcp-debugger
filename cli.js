#!/usr/bin/env node
import minimist from "minimist";
import getLcpData from "./index.js";

const argv = minimist(process.argv.slice(2));

if (!argv._.length || !URL.canParse(argv._[0])) {
  process.stderr.write(usage());
  process.exit(1);
}

const DEFAULT_OPTIONS = {
  output: "json",
  outputPath: "stdout",
};

const kebabToCamel = (str) => str.replace(/-./g, (x) => x[1].toUpperCase());
const options = {
  ...DEFAULT_OPTIONS,
  ...Object.fromEntries(
    Object.entries(argv).map(([k, v]) => [kebabToCamel(k), v])
  ),
};

const data = await getLcpData(argv._[0], options);

if (argv.output !== "json") {
  process.stderr.write(
    `Unsupported output type "${argv.output}". Defaulting to "json".\n`
  );
}

process.stdout.write(JSON.stringify(data, null, 4));

function usage() {
  return `lcp-debugger <url> <options>

  Logging options:
    --verbose   Display verbose logging

  Output:
    --output        Output format ["json"] [default: "${DEFAULT_OPTIONS.output}"]
    --output-path   The path to write the output to. Use "stdout" to write to stdout. [default: "${DEFAULT_OPTIONS.outputPath}"]

  Configuration:
    --preset       Use one of the preset configurations ["desktop" | "mobile"] [default: "desktop"]
    --device       Use a specific Playwright device configuration (overrides --preset)
`;
}
