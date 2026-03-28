import normalizeErrors from "./normalizeErrors.ts";

export default function getWarnings(stats) {
  return normalizeErrors(stats.compilation.warnings).sort();
}
