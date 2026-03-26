import type { Compilation } from "@rspack/core";

export interface CompressedResult {
  name: string;
  buffer: Buffer;
  algorithm: string;
  originalSize: number;
  compressedSize: number;
}

export type AlgorithmFn = (
  input: Buffer,
  options: Record<string, unknown>,
  callback: (err: Error | null, result: Buffer) => void,
) => void;

export type Algorithm = string | AlgorithmFn;

export const KEEP_SOURCE_MAP = "keep-source-map";
export type DeleteOriginalAssets = boolean | typeof KEEP_SOURCE_MAP | ((name: string) => boolean);
export type FilenameTemplate = string | ((pathData: { filename: string }) => string);

export type CompressorFn = (
  eligible: Array<{ name: string; buffer: Buffer }>,
  compilation: Compilation,
) => Promise<CompressedResult[]>;

export type Rule = RegExp | string;
export type Rules = Rule[] | Rule;

export interface CompressionRspackPluginOptions {
  algorithm?: Algorithm;
  compressionOptions?: Record<string, unknown>;
  filename?: FilenameTemplate;
  test?: Rules;
  include?: Rules;
  exclude?: Rules;
  threshold?: number;
  minRatio?: number;
  deleteOriginalAssets?: DeleteOriginalAssets;
}

export type ResolvedOptions = Required<
  Pick<
    CompressionRspackPluginOptions,
    | "algorithm"
    | "compressionOptions"
    | "filename"
    | "threshold"
    | "minRatio"
    | "deleteOriginalAssets"
  >
> &
  Pick<CompressionRspackPluginOptions, "test" | "include" | "exclude">;
