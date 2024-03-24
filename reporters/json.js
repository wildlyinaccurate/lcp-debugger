export function jsonReporter(data) {
  process.stdout.write(JSON.stringify(data, null, 4));
}
