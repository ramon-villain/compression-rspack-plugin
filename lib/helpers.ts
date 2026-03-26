import crypto from "node:crypto";
import path from "node:path";
import zlib from "node:zlib";

import type { Asset } from "@rspack/core";

import type { Algorithm, DeleteOriginalAssets, FilenameTemplate } from "./types.ts";
import { KEEP_SOURCE_MAP } from "./types.ts";

export const NATIVE_ALGORITHMS = ["gzip", "brotliCompress", "deflate", "deflateRaw"] as const;
export type NativeAlgorithm = (typeof NATIVE_ALGORITHMS)[number];
const NATIVE_SET = new Set<string>(NATIVE_ALGORITHMS);

export const isNativeAlgorithm = (alg: unknown): alg is NativeAlgorithm =>
  typeof alg === "string" && NATIVE_SET.has(alg);

export const ALGORITHM_DEFAULTS: Partial<Record<NativeAlgorithm, Record<string, unknown>>> = {
  gzip: { level: zlib.constants.Z_BEST_COMPRESSION },
  deflate: { level: zlib.constants.Z_BEST_COMPRESSION },
  deflateRaw: { level: zlib.constants.Z_BEST_COMPRESSION },
  brotliCompress: {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY },
  },
};

export const getBuffer = (asset: Asset): Buffer => {
  let buffer: ReturnType<typeof asset.source.buffer>;

  if (typeof asset.source.buffer === "function") {
    buffer = asset.source.buffer();
  } else {
    buffer = asset.source.source();
    if (!Buffer.isBuffer(buffer)) {
      buffer = Buffer.from(buffer);
    }
  }

  return buffer;
};

export const shouldDeleteOriginal = (policy: DeleteOriginalAssets, filename: string): boolean => {
  if (typeof policy !== "function") {
    return policy === true || policy === KEEP_SOURCE_MAP;
  }

  return policy(filename);
};

export const resolveRelatedName = (algorithm: Algorithm, filename: FilenameTemplate): string => {
  if (typeof algorithm === "function") {
    if (typeof filename === "function") {
      return `compression-function-${crypto.createHash("md5").update(String(filename)).digest("hex")}`;
    }
    return `${path.extname(filename.split("?")[0]).slice(1)}ed`;
  }

  return algorithm === "gzip" ? "gzipped" : `${algorithm}ed`;
};

export const hasImmutablePlaceholder = (filename: FilenameTemplate): boolean =>
  typeof filename === "string" && /\[(?:name|base|file)]/.test(filename);
