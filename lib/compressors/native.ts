import { createRequire } from "node:module";
import zlib from "node:zlib";

import type { Algorithm, CompressedResult, CompressorFn } from "../types.ts";

interface NativeBinding {
  compressAssets(
    assets: Array<{ name: string; buffer: Buffer }>,
    options: { algorithm: string; level?: number },
  ): CompressedResult[];
}

let nativeBinding: NativeBinding;
try {
  nativeBinding = createRequire(import.meta.url)("../../index.cjs");
} catch (err) {
  console.error("[compression-rspack-plugin] Failed to load native addon. Run `pnpm build` first.");
  throw err;
}

const extractLevel = (algorithm: string, options: Record<string, unknown>): number | undefined => {
  if (algorithm === "brotliCompress") {
    const { params } = options;
    if (typeof params === "object" && params !== null) {
      const quality = (params as Record<string | number, unknown>)[
        zlib.constants.BROTLI_PARAM_QUALITY
      ];
      return typeof quality === "number" ? quality : undefined;
    }
    return undefined;
  }
  return typeof options.level === "number" ? options.level : undefined;
};

export const compressNativeBinding = (
  algorithm: Algorithm,
  compressionOptions: Record<string, unknown>,
): CompressorFn => {
  if (typeof algorithm !== "string") {
    throw new Error("Algorithm is not a string");
  }

  return async (eligible) =>
    nativeBinding.compressAssets(eligible, {
      algorithm,
      level: extractLevel(algorithm, compressionOptions),
    });
};
