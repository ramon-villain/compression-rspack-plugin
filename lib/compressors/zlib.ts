import { promisify } from "node:util";
import zlib from "node:zlib";

import pLimit from "p-limit";

import type { Algorithm, CompressedResult, CompressorFn } from "../types.ts";

const zlibLimit = pLimit(parseInt(process.env.UV_THREADPOOL_SIZE ?? "4", 10));
const CUSTOM_ALGORITHM = "custom";

const compressWithZlib = async (
  algorithm: Algorithm,
  content: Buffer,
  options: Record<string, unknown>,
): Promise<Buffer> => {
  const fn = typeof algorithm === "function" ? algorithm : zlib[algorithm as keyof typeof zlib];
  if (typeof fn !== "function") {
    throw new Error(`Algorithm "${algorithm}" is not found in "zlib"`);
  }
  return promisify(fn)(content, options);
};

export const compressNodeZlib = (
  algorithm: Algorithm,
  compressionOptions: Record<string, unknown>,
): CompressorFn => {
  const algorithmName = typeof algorithm === "string" ? algorithm : CUSTOM_ALGORITHM;

  return async (eligible, compilation) => {
    const results = await Promise.all(
      eligible.map(({ name, buffer }) =>
        zlibLimit(async (): Promise<CompressedResult | null> => {
          try {
            const compressed = await compressWithZlib(algorithm, buffer, compressionOptions);
            return {
              name,
              buffer: compressed,
              algorithm: algorithmName,
              originalSize: buffer.length,
              compressedSize: compressed.length,
            };
          } catch (error) {
            compilation.errors.push(error instanceof Error ? error : new Error(String(error)));
            return null;
          }
        }),
      ),
    );
    return results.filter((r): r is CompressedResult => r !== null);
  };
};
