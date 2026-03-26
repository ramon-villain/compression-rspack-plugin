import { createRequire } from "node:module";
import zlib from "node:zlib";
import type { Asset, Compilation, Compiler } from "@rspack/core";
// @ts-expect-error not exported
import type { StatsPrinter, StatsPrinterContext } from "@rspack/core/dist/stats/StatsPrinter.d.ts";
import { validate } from "schema-utils";

import { compressNativeBinding } from "./compressors/native.ts";
import { compressNodeZlib } from "./compressors/zlib.ts";
import {
  ALGORITHM_DEFAULTS,
  getBuffer,
  hasImmutablePlaceholder,
  isNativeAlgorithm,
  resolveRelatedName,
  shouldDeleteOriginal,
} from "./helpers.ts";
import type {
  CompressedResult,
  CompressionRspackPluginOptions,
  FilenameTemplate,
  ResolvedOptions,
} from "./types.ts";
import { KEEP_SOURCE_MAP } from "./types.ts";

export class CompressionRspackPlugin {
  static readonly PLUGIN_NAME = "CompressionRspackPlugin";

  private readonly opts: ResolvedOptions;
  private readonly compress: ReturnType<typeof compressNativeBinding>;
  private readonly relatedName: string;
  private readonly canPreserveImmutable: boolean;

  constructor(baseOptions: CompressionRspackPluginOptions = {}) {
    validate(
      createRequire(import.meta.url)("./options.json") as Parameters<typeof validate>[0],
      baseOptions,
      {
        name: "Compression Plugin",
        baseDataPath: "options",
      },
    );

    const options = Object.assign(
      {},
      {
        algorithm: "gzip",
        threshold: 0,
        minRatio: 0.8,
        deleteOriginalAssets: false,
        compressionOptions: {},
      },
      baseOptions,
    );

    if (typeof options.algorithm === "string" && !isNativeAlgorithm(options.algorithm)) {
      if (typeof zlib[options.algorithm as keyof typeof zlib] !== "function") {
        throw new Error(`Algorithm "${options.algorithm}" is not found in "zlib"`);
      }
    }

    const compressionOptions = Object.assign(
      {},
      isNativeAlgorithm(options.algorithm) ? ALGORITHM_DEFAULTS[options.algorithm] : undefined,
      options.compressionOptions,
    );

    this.opts = {
      filename: options.algorithm === "brotliCompress" ? "[path][base].br" : "[path][base].gz",
      ...options,
      compressionOptions,
    };

    this.relatedName = resolveRelatedName(this.opts.algorithm, this.opts.filename);
    this.canPreserveImmutable = hasImmutablePlaceholder(this.opts.filename);

    this.compress = (
      isNativeAlgorithm(options.algorithm) ? compressNativeBinding : compressNodeZlib
    )(options.algorithm, compressionOptions);
  }

  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap(
      CompressionRspackPlugin.PLUGIN_NAME,
      (compilation: Compilation) => {
        compilation.hooks.processAssets.tapPromise(
          {
            name: CompressionRspackPlugin.PLUGIN_NAME,
            stage: compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
            additionalAssets: true,
          },
          async () => {
            const eligible: Array<{ name: string; buffer: Buffer }> = [];

            for (const asset of compilation.getAssets()) {
              if (
                !compiler.rspack.ModuleFilenameHelpers.matchObject.bind(
                  undefined,
                  this.opts,
                )(asset.name) ||
                asset.info?.compressed
              ) {
                continue;
              }

              const buffer = getBuffer(asset);
              if (buffer.length >= this.opts.threshold) {
                eligible.push({ name: asset.name, buffer });
              }
            }

            if (eligible.length === 0) return;

            await this.applyResults(compilation, compiler, eligible);
          },
        );

        compilation.hooks.statsPrinter.tap(
          CompressionRspackPlugin.PLUGIN_NAME,
          (statsPrinter: StatsPrinter) => {
            statsPrinter.hooks.print
              .for("asset.info.compressed")
              .tap(
                CompressionRspackPlugin.PLUGIN_NAME,
                (compressed: boolean, { green, formatFlag }: StatsPrinterContext) =>
                  compressed ? green(formatFlag("compressed")) : undefined,
              );
          },
        );
      },
    );
  }

  private async applyResults(
    compilation: Compilation,
    compiler: Compiler,
    eligible: Array<{ name: string; buffer: Buffer }>,
  ): Promise<void> {
    const results = await this.compress(eligible, compilation);

    if (results.length === 0) return;

    const filesAndRelatedToDelete = new Map<string, Asset["info"]["related"] | undefined>();

    for (const result of results) {
      if (
        result.originalSize > 0 &&
        result.compressedSize / result.originalSize >= this.opts.minRatio
      ) {
        continue;
      }

      const original = compilation.getAsset(result.name);
      const newFilename = this.getNewFileName(this.opts.filename, result, compilation);
      const willDelete = shouldDeleteOriginal(this.opts.deleteOriginalAssets, result.name);

      if (!willDelete && original) {
        compilation.updateAsset(
          result.name,
          (source: Asset["source"]) => source,
          (assetInfo) => {
            assetInfo.related = {
              ...assetInfo.related,
              [this.relatedName]: newFilename,
            };
            return assetInfo;
          },
        );
      }

      compilation.emitAsset(
        newFilename,
        new compiler.rspack.sources.RawSource(result.buffer, false),
        {
          compressed: true,
          ...(this.canPreserveImmutable && original?.info?.immutable ? { immutable: true } : {}),
        },
      );

      if (willDelete) {
        filesAndRelatedToDelete.set(result.name, original?.info?.related);
      }
    }

    if (filesAndRelatedToDelete.size > 0) {
      for (const [filename, related] of filesAndRelatedToDelete) {
        if (this.opts.deleteOriginalAssets === KEEP_SOURCE_MAP && related?.sourceMap) {
          try {
            compilation.updateAsset(
              filename,
              (source: Asset["source"]) => source,
              (info) => {
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
        compilation.deleteAsset(filename);
      }
    }
  }

  private getNewFileName(
    filename: FilenameTemplate,
    result: CompressedResult,
    compilation: Compilation,
  ) {
    return typeof filename === "function"
      ? filename({ filename: result.name })
      : compilation.getPath(filename, { filename: result.name });
  }
}
