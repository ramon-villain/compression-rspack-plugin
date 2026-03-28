import normalizeErrors from "./normalizeErrors.ts";

export default function getErrors(stats) {
  return normalizeErrors(stats.compilation.errors).sort();
}
