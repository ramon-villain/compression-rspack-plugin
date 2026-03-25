import normalizeErrors from "./normalizeErrors.mjs";

export default function getErrors(stats) {
  return normalizeErrors(stats.compilation.errors).sort();
}
