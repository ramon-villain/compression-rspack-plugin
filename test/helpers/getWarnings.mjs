import normalizeErrors from "./normalizeErrors.mjs";

export default function getWarnings(stats) {
  return normalizeErrors(stats.compilation.warnings).sort();
}
