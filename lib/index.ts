import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import zlib from "node:zlib";

import type { AssetInfo, Compilation, Compiler } from "@rspack/core";
import pLimit from "p-limit";
import { validate } from "schema-utils";
import serialize from "serialize-javascript";

const _require = createRequire(import.meta.url);
const schema = _require("./options.json");

interface CompressedResult {
  filename: string;
  content: Buffer;
  algorithm: string;
  originalSize: number;
  compressedSize: number;
}

interface NativeBinding {
  compressAssets(
    assets: Array<{ filename: string; content: Buffer }>,
    options: { algorithm: string; level?: number },
  ): CompressedResult[];
}

interface StatsPrinterContext {
  green: (str: string) => string;
  formatFlag: (flag: string) => string;
}

interface StatsPrinterPrintHook {
  for(key: string): {
    tap(
      name: string,
      fn: (value: unknown, context: StatsPrinterContext) => string | undefined,
    ): void;
  };
}

interface StatsPrinter {
  hooks: { print: StatsPrinterPrintHook };
}

type RawSourceConstructor = new (
  content: Buffer,
  convertToString: boolean,
) => { source(): string | Buffer };

let nativeBinding: NativeBinding;
try {
  nativeBinding = _require("../index.cjs");
} catch (err) {
  console.error("[compression-rspack-plugin] Failed to load native addon. Run `pnpm build` first.");
  throw err;
}

const { compressAssets } = nativeBinding;

const NATIVE_ALGORITHMS = ["gzip", "brotliCompress", "deflate", "deflateRaw"] as const;
type NativeAlgorithm = (typeof NATIVE_ALGORITHMS)[number];
const NATIVE_SET: ReadonlySet<string> = new Set(NATIVE_ALGORITHMS);

function isNativeAlgorithm(alg: string): alg is NativeAlgorithm {
  return NATIVE_SET.has(alg);
}

type AlgorithmFn = (
  input: Buffer,
  options: Record<string, unknown>,
  callback: (err: Error | null, result: Buffer) => void,
) => void;

type Algorithm = string | AlgorithmFn;

const KEEP_SOURCE_MAP = "keep-source-map" as const;
const CUSTOM_ALGORITHM = "custom" as const;
type DeleteOriginalAssets = boolean | typeof KEEP_SOURCE_MAP | ((name: string) => boolean);
type FilenameTemplate = string | ((pathData: { filename: string }) => string);

const ALGORITHM_DEFAULTS: Partial<Record<NativeAlgorithm, Record<string, unknown>>> = {
  gzip: { level: zlib.constants.Z_BEST_COMPRESSION },
  deflate: { level: zlib.constants.Z_BEST_COMPRESSION },
  deflateRaw: { level: zlib.constants.Z_BEST_COMPRESSION },
  brotliCompress: {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY },
  },
};

const DEFAULT_FILENAMES: Partial<Record<string, string>> = {
  brotliCompress: "[path][base].br",
};
const DEFAULT_FILENAME = "[path][base].gz";

const ZLIB_CONCURRENCY = parseInt(process.env.UV_THREADPOOL_SIZE ?? "", 10) || 4;
const IMMUTABLE_TEMPLATE_RE = /\[(?:name|base|file)]/;
const zlibLimit = pLimit(ZLIB_CONCURRENCY);

type Rule = RegExp | string;
type Rules = Rule[] | Rule;

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

type ResolvedOptions = Required<
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

function resolveRelatedName(algorithm: Algorithm, filename: FilenameTemplate): string {
  if (typeof algorithm === "function") {
    if (typeof filename === "function") {
      const crypto = _require("node:crypto");
      return `compression-function-${crypto
        .createHash("md5")
        .update(String(filename))
        .digest("hex")}`;
    }
    const clean = filename.split("?")[0];
    return `${path.extname(clean).slice(1)}ed`;
  }
  if (algorithm === "gzip") return "gzipped";
  return `${algorithm}ed`;
}

async function compressWithZlib(
  algorithm: Algorithm,
  content: Buffer,
  compressionOptions: Record<string, unknown>,
): Promise<Buffer> {
  if (typeof algorithm === "function") {
    return promisify(algorithm)(content, compressionOptions);
  }

  const fn = zlib[algorithm as keyof typeof zlib];
  if (typeof fn !== "function") {
    throw new Error(`Algorithm "${algorithm}" is not found in "zlib"`);
  }

  return promisify(fn as AlgorithmFn)(content, compressionOptions);
}

function extractLevel(
  algorithm: string,
  compressionOptions: Record<string, unknown>,
): number | undefined {
  if (algorithm === "brotliCompress") {
    const { params } = compressionOptions;
    if (typeof params === "object" && params !== null) {
      const quality = (params as Record<string | number, unknown>)[
        zlib.constants.BROTLI_PARAM_QUALITY
      ];
      return typeof quality === "number" ? quality : undefined;
    }
    return undefined;
  }
  const { level } = compressionOptions;
  return typeof level === "number" ? level : undefined;
}

function getAssetContent(asset: ReturnType<Compilation["getAssets"]>[number]): Buffer {
  const raw =
    typeof asset.source.buffer === "function" ? asset.source.buffer() : asset.source.source();
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw as string);
}

function shouldDeleteOriginal(policy: DeleteOriginalAssets, filename: string): boolean {
  if (typeof policy === "function") return policy(filename);
  return policy === true || policy === KEEP_SOURCE_MAP;
}

export class CompressionRspackPlugin {
  static readonly PLUGIN_NAME = "CompressionRspackPlugin";

  private readonly opts: ResolvedOptions;
  private readonly isNative: boolean;
  private readonly algorithmName: string;

  constructor(options: CompressionRspackPluginOptions = {}) {
    validate(schema as Parameters<typeof validate>[0], options, {
      name: "Compression Plugin",
      baseDataPath: "options",
    });

    const algorithm = options.algorithm ?? "gzip";

    if (typeof algorithm === "string" && !isNativeAlgorithm(algorithm)) {
      if (typeof zlib[algorithm as keyof typeof zlib] !== "function") {
        throw new Error(`Algorithm "${algorithm}" is not found in "zlib"`);
      }
    }

    this.isNative = typeof algorithm === "string" && isNativeAlgorithm(algorithm);
    this.algorithmName = typeof algorithm === "string" ? algorithm : CUSTOM_ALGORITHM;

    const defaults = this.isNative ? (ALGORITHM_DEFAULTS[algorithm as NativeAlgorithm] ?? {}) : {};

    this.opts = {
      algorithm,
      compressionOptions: { ...defaults, ...options.compressionOptions },
      filename: options.filename ?? DEFAULT_FILENAMES[this.algorithmName] ?? DEFAULT_FILENAME,
      test: options.test,
      include: options.include,
      exclude: options.exclude,
      threshold: options.threshold ?? 0,
      minRatio: options.minRatio ?? 0.8,
      deleteOriginalAssets: options.deleteOriginalAssets ?? false,
    };
  }

  private isEligible(
    filename: string,
    info: AssetInfo | undefined,
    matchObject: (name: string) => boolean,
  ): boolean {
    if (info?.compressed) return false;
    return matchObject(filename);
  }

  apply(compiler: Compiler) {
    compiler.hooks.thisCompilation.tap(
      CompressionRspackPlugin.PLUGIN_NAME,
      (compilation: Compilation) => {
        const matchObject = compiler.webpack.ModuleFilenameHelpers.matchObject.bind(
          undefined,
          this.opts,
        );

        compilation.hooks.processAssets.tapPromise(
          {
            name: CompressionRspackPlugin.PLUGIN_NAME,
            stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
            additionalAssets: true,
          },
          async () => {
            const cache = compilation.getCache(CompressionRspackPlugin.PLUGIN_NAME);
            const { RawSource } = compiler.rspack.sources;

            const eligible: Array<{
              filename: string;
              content: Buffer;
              source: { source(): string | Buffer };
            }> = [];

            for (const asset of compilation.getAssets()) {
              const { name: filename } = asset;
              if (!this.isEligible(filename, asset.info, matchObject)) continue;

              const content = getAssetContent(asset);
              if (content.length < this.opts.threshold) continue;

              eligible.push({ filename, content, source: asset.source });
            }

            if (eligible.length === 0) return;

            // Check cache for each asset — separate hits from misses
            const cached: CompressedResult[] = [];
            const uncached: Array<{ filename: string; content: Buffer }> = [];
            const cacheItems: Array<{
              filename: string;
              item: ReturnType<typeof cache.getItemCache>;
            }> = [];

            await Promise.all(
              eligible.map(async ({ filename, content, source }) => {
                const etag = cache.getLazyHashedEtag(source as any);
                const cacheItem = cache.getItemCache(
                  serialize({
                    name: filename,
                    algorithm: this.opts.algorithm,
                    compressionOptions: this.opts.compressionOptions,
                  }),
                  etag,
                );
                const cachedResult =
                  (await cacheItem.getPromise()) as CompressedResult | undefined;

                if (cachedResult) {
                  cached.push(cachedResult);
                } else {
                  uncached.push({ filename, content });
                  cacheItems.push({ filename, item: cacheItem });
                }
              }),
            );

            // Compress only cache misses
            let freshResults: CompressedResult[];
            if (uncached.length === 0) {
              freshResults = [];
            } else if (this.isNative) {
              const level = extractLevel(this.algorithmName, this.opts.compressionOptions);
              freshResults = compressAssets(uncached, {
                algorithm: this.algorithmName,
                level,
              });
            } else {
              freshResults = await this.compressZlib(uncached, compilation);
            }

            // Store fresh results in cache
            await Promise.all(
              freshResults.map(async (result) => {
                const entry = cacheItems.find((c) => c.filename === result.filename);
                if (entry) {
                  await entry.item.storePromise(result);
                }
              }),
            );

            const results = [...cached, ...freshResults];
            this.emitResults(compilation, results, RawSource);
          },
        );

        compilation.hooks.statsPrinter.tap(
          CompressionRspackPlugin.PLUGIN_NAME,
          (statsPrinter: StatsPrinter) => {
            statsPrinter.hooks.print
              .for("asset.info.compressed")
              .tap(
                CompressionRspackPlugin.PLUGIN_NAME,
                (compressed: unknown, { green, formatFlag }: StatsPrinterContext) =>
                  compressed ? green(formatFlag("compressed")) : undefined,
              );
          },
        );
      },
    );
  }

  private async compressZlib(
    eligible: Array<{ filename: string; content: Buffer }>,
    compilation: Compilation,
  ): Promise<CompressedResult[]> {
    const { algorithm, compressionOptions } = this.opts;

    const results = await Promise.all(
      eligible.map(({ filename, content }) =>
        zlibLimit(async (): Promise<CompressedResult | null> => {
          try {
            const compressed = await compressWithZlib(algorithm, content, compressionOptions);
            return {
              filename,
              content: compressed,
              algorithm: this.algorithmName,
              originalSize: content.length,
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
  }

  private emitCompressedAsset(
    compilation: Compilation,
    result: CompressedResult,
    RawSource: RawSourceConstructor,
    relatedName: string,
    canPreserveImmutable: boolean,
  ): void {
    const { filename: tmpl, deleteOriginalAssets } = this.opts;

    const newFilename =
      typeof tmpl === "function"
        ? tmpl({ filename: result.filename })
        : compilation.getPath(tmpl, { filename: result.filename });

    const original = compilation.getAsset(result.filename);
    const info: AssetInfo = { compressed: true };

    if (canPreserveImmutable && original?.info?.immutable) {
      info.immutable = true;
    }

    if (!shouldDeleteOriginal(deleteOriginalAssets, result.filename) && original) {
      compilation.updateAsset(
        result.filename,
        (source: unknown) => source,
        (assetInfo: AssetInfo) => {
          assetInfo.related = { ...assetInfo.related, [relatedName]: newFilename };
          return assetInfo;
        },
      );
    }

    compilation.emitAsset(newFilename, new RawSource(result.content, false), info);
  }

  private cleanupOriginals(compilation: Compilation, filenames: ReadonlySet<string>): void {
    for (const filename of filenames) {
      if (this.opts.deleteOriginalAssets === KEEP_SOURCE_MAP) {
        const asset = compilation.getAsset(filename);
        const related = asset?.info?.related;
        if (asset && related?.sourceMap) {
          try {
            compilation.updateAsset(
              filename,
              (source: unknown) => source,
              (info: AssetInfo) => {
                info.related = { ...related, sourceMap: undefined };
                return info;
              },
            );
          } catch (err) {
            compilation.warnings.push(
              new Error(
                `[compression-rspack-plugin] Could not detach source map for "${filename}": ${
                  err instanceof Error ? err.message : String(err)
                }`,
              ),
            );
          }
        }
      }
      compilation.deleteAsset(filename);
    }
  }

  private emitResults(
    compilation: Compilation,
    compressed: CompressedResult[],
    RawSource: RawSourceConstructor,
  ): void {
    const { minRatio, deleteOriginalAssets } = this.opts;
    const canPreserveImmutable =
      typeof this.opts.filename === "string" && IMMUTABLE_TEMPLATE_RE.test(this.opts.filename);
    const relatedName = resolveRelatedName(this.opts.algorithm, this.opts.filename);
    const originalsToDelete = new Set<string>();

    for (const result of compressed) {
      if (result.originalSize > 0 && result.compressedSize / result.originalSize >= minRatio) {
        continue;
      }

      this.emitCompressedAsset(compilation, result, RawSource, relatedName, canPreserveImmutable);

      if (shouldDeleteOriginal(deleteOriginalAssets, result.filename)) {
        originalsToDelete.add(result.filename);
      }
    }

    if (originalsToDelete.size > 0) {
      this.cleanupOriginals(compilation, originalsToDelete);
    }
  }
}
