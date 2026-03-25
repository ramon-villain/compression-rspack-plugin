import zlib from "node:zlib";

import readAsset from "./readAsset.mjs";

const HASH_RE = /[a-f0-9]{16,}/g;

function normalizeHash(value) {
  if (typeof value === "string") return value.replace(HASH_RE, "[hash]");
  if (Array.isArray(value)) return value.map(normalizeHash);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = normalizeHash(v);
    }
    return out;
  }
  return value;
}

export default function getAssetsNameAndSize(stats, compiler) {
  const { assets } = stats.compilation;

  return Object.keys(assets)
    .sort()
    .map((name) => {
      const info = stats.compilation.getAsset(name)?.info || {};
      const normalizedInfo = normalizeHash(info);
      const size = normalizedInfo.compressed ? "<compressed>" : assets[name].size();
      const item = [normalizeHash(name), size, normalizedInfo];

      if (compiler && info.related?.gzipped) {
        const original = readAsset(name, compiler, stats);
        const gzipped = readAsset(info.related.gzipped, compiler, stats);

        if (Buffer.isBuffer(original) && Buffer.isBuffer(gzipped)) {
          const ungzipped = zlib.gunzipSync(gzipped);
          if (!ungzipped.equals(original)) {
            throw new Error(`Ungzipped version of "${name}" is not equal to original`);
          }
        }
      }

      return item;
    });
}
