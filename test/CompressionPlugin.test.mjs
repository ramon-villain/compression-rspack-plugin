import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

import { StatsWriterPlugin } from "webpack-stats-plugin";

import { CompressionRspackPlugin } from "../dist/index.js";

import ChildCompilationPlugin from "./helpers/ChildCompilationPlugin.mjs";
import CopyPluginWithAssetInfo from "./helpers/CopyPluginWithAssetInfo.mjs";
import compile from "./helpers/compile.mjs";
import EmitNewAsset from "./helpers/EmitNewAsset.mjs";
import getAssetsNameAndSize from "./helpers/getAssetsNameAndSize.mjs";
import getCompiler from "./helpers/getCompiler.mjs";
import getErrors from "./helpers/getErrors.mjs";
import getWarnings from "./helpers/getWarnings.mjs";
import ModifyExistingAsset from "./helpers/ModifyExistingAsset.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("CompressionRspackPlugin", () => {
  it("should work", async () => {
    const compiler = getCompiler(
      "./entry.js",
      {},
      {
        output: {
          path: path.join(__dirname, "./dist"),
          filename: "[name].js?var=[contenthash]",
          chunkFilename: "[id].[name].js?ver=[contenthash]",
        },
      },
    );

    new CompressionRspackPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("should work with assets info", async () => {
    const compiler = getCompiler(
      "./entry.js",
      {},
      {
        devtool: "source-map",
        output: {
          path: path.join(__dirname, "./dist"),
          filename: "[name].js?var=[contenthash]",
          chunkFilename: "[id].[name].js?ver=[contenthash]",
        },
      },
    );

    new CompressionRspackPlugin().apply(compiler);
    new CopyPluginWithAssetInfo().apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("should work with multiple plugins", async () => {
    const compiler = getCompiler(
      "./entry.js",
      {},
      {
        output: {
          path: path.join(__dirname, "./dist"),
          filename: "[name].js?var=[contenthash]",
          chunkFilename: "[id].[name].js?ver=[contenthash]",
        },
      },
    );

    new CompressionRspackPlugin({
      algorithm: "gzip",
      filename: "[path][base].gz",
    }).apply(compiler);
    new CompressionRspackPlugin({
      algorithm: "brotliCompress",
      filename: "[path][base].br",
    }).apply(compiler);
    new CompressionRspackPlugin({
      minRatio: Infinity,
      algorithm: (input, _options, callback) => callback(null, input),
      filename: "[path][base].compress",
    }).apply(compiler);
    new CompressionRspackPlugin({
      minRatio: Infinity,
      algorithm: (input, _options, callback) => callback(null, input),
      filename: "[path][base].custom?foo=bar#hash",
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("should work and show compress assets in stats", async () => {
    const compiler = getCompiler(
      "./entry.js",
      {},
      {
        stats: "verbose",
        output: {
          path: path.join(__dirname, "./dist"),
          filename: "[name].js",
          chunkFilename: "[id].[name].js",
        },
      },
    );

    new CompressionRspackPlugin().apply(compiler);

    const stats = await compile(compiler);

    // Verify compressed assets exist and have compressed info
    const compressedAssets = stats.compilation.getAssets().filter((a) => a.info?.compressed);
    expect(compressedAssets.length).toBeGreaterThan(0);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("should work and keep assets info", async () => {
    const compiler = getCompiler(
      "./entry.js",
      {},
      {
        stats: "verbose",
        output: {
          path: path.join(__dirname, "./dist"),
          filename: "[name].[contenthash].js",
          chunkFilename: "[id].[name].[contenthash].js",
        },
      },
    );

    new CompressionRspackPlugin().apply(compiler);

    const stats = await compile(compiler);

    // Verify all assets have immutable info (contenthash in filename)
    for (const asset of stats.compilation.getAssets()) {
      expect(asset.info.immutable).toBe(true);
    }

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it('should work and use memory cache without options in the "development" mode', async () => {
    const compiler = getCompiler("./entry.js", {}, { mode: "development" });

    new CompressionRspackPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");

    const newStats = await compile(compiler);

    expect(getAssetsNameAndSize(newStats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(newStats)).toMatchSnapshot("warnings");
    expect(getErrors(newStats)).toMatchSnapshot("errors");
  });

  it('should work and use memory cache when the "cache" option is "true"', async () => {
    const compiler = getCompiler(
      "./entry.js",
      {},
      {
        cache: true,
        output: {
          path: path.resolve(__dirname, "./outputs"),
          filename: "[name].js",
          chunkFilename: "[id].js",
        },
      },
    );

    new CompressionRspackPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");

    const newStats = await compile(compiler);

    expect(getAssetsNameAndSize(newStats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(newStats)).toMatchSnapshot("warnings");
    expect(getErrors(newStats)).toMatchSnapshot("errors");
  });

  it('should work and use memory cache when the "cache" option is "true" and the asset has been changed', async () => {
    const compiler = getCompiler(
      "./entry.js",
      {},
      {
        cache: true,
        output: {
          path: path.resolve(__dirname, "./outputs"),
          filename: "[name].js",
          chunkFilename: "[id].js",
        },
      },
    );

    new CompressionRspackPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");

    new ModifyExistingAsset({
      name: "main.js",
      content: "function changed() { /*! CHANGED */ }",
    }).apply(compiler);

    const newStats = await compile(compiler);

    expect(getAssetsNameAndSize(newStats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(newStats)).toMatchSnapshot("warnings");
    expect(getErrors(newStats)).toMatchSnapshot("errors");
  });

  it('should work and use memory cache when the "cache" option is "true" and the asset has been changed which filtered by the "minRatio" option', async () => {
    const compiler = getCompiler(
      "./entry.js",
      {},
      {
        cache: true,
        output: {
          path: path.resolve(__dirname, "./outputs"),
          filename: "[name].js",
          chunkFilename: "[id].js",
        },
      },
    );

    new CompressionRspackPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");

    new ModifyExistingAsset({
      name: "icon.png",
      content: "1q!Q2w@W3e#e4r$r".repeat(1000),
    }).apply(compiler);

    const newStats = await compile(compiler);

    expect(getAssetsNameAndSize(newStats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(newStats)).toMatchSnapshot("warnings");
    expect(getErrors(newStats)).toMatchSnapshot("errors");
  });

  it('should work and use memory cache when the "cache" option is "true" with multiple plugins', async () => {
    const compiler = getCompiler(
      "./entry.js",
      {},
      {
        cache: true,
        output: {
          path: path.resolve(__dirname, "./outputs"),
          filename: "[name].js",
          chunkFilename: "[id].js",
        },
      },
    );

    new CompressionRspackPlugin({
      filename: "[path][base].gz",
      algorithm: "gzip",
    }).apply(compiler);
    new CompressionRspackPlugin({
      filename: "[path][base].br",
      algorithm: "brotliCompress",
    }).apply(compiler);
    new CompressionRspackPlugin({
      minRatio: Infinity,
      algorithm: (input, _options, callback) => callback(null, input),
      filename: "[path][base].custom",
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");

    const newStats = await compile(compiler);

    expect(getAssetsNameAndSize(newStats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(newStats)).toMatchSnapshot("warnings");
    expect(getErrors(newStats)).toMatchSnapshot("errors");
  });

  it('should work and do not use memory cache when the "cache" option is "false"', async () => {
    const compiler = getCompiler(
      "./entry.js",
      {},
      {
        cache: false,
        output: {
          path: path.resolve(__dirname, "./outputs"),
          filename: "[name].js",
          chunkFilename: "[id].[name].js",
        },
      },
    );

    new CompressionRspackPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");

    const newStats = await compile(compiler);

    expect(getAssetsNameAndSize(newStats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(newStats)).toMatchSnapshot("warnings");
    expect(getErrors(newStats)).toMatchSnapshot("errors");
  });

  it("should run plugin against assets added later by plugins", async () => {
    const compiler = getCompiler(
      "./number.js",
      {},
      {
        output: {
          path: path.resolve(__dirname, "./outputs"),
          filename: "[name].js",
          chunkFilename: "[id].js",
        },
      },
    );

    new CompressionRspackPlugin({ minRatio: 10 }).apply(compiler);
    new EmitNewAsset({ name: "newFile.js" }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("should work with 'webpack-stats-plugin'", async () => {
    const compiler = getCompiler("./entry.js");

    new CompressionRspackPlugin().apply(compiler);
    new StatsWriterPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("should produce valid gzip output", async () => {
    const compiler = getCompiler(
      "./simple.js",
      {},
      {
        output: { path: "/build", filename: "[name].js" },
      },
    );

    new CompressionRspackPlugin().apply(compiler);
    const stats = await compile(compiler);

    const originalAsset = stats.compilation.assets["main.js"];
    const gzAsset = stats.compilation.assets["main.js.gz"];

    const originalBuf = Buffer.from(originalAsset.source());
    const gzBuf =
      typeof gzAsset.source() === "string" ? Buffer.from(gzAsset.source()) : gzAsset.source();

    const decompressed = zlib.gunzipSync(gzBuf);
    expect(decompressed).toEqual(originalBuf);
  });

  it("should produce valid brotli output", async () => {
    const compiler = getCompiler(
      "./simple.js",
      {},
      {
        output: { path: "/build", filename: "[name].js" },
      },
    );

    new CompressionRspackPlugin({ algorithm: "brotliCompress" }).apply(compiler);
    const stats = await compile(compiler);

    const originalAsset = stats.compilation.assets["main.js"];
    const brAsset = stats.compilation.assets["main.js.br"];

    const originalBuf = Buffer.from(originalAsset.source());
    const brBuf =
      typeof brAsset.source() === "string" ? Buffer.from(brAsset.source()) : brAsset.source();

    const decompressed = zlib.brotliDecompressSync(brBuf);
    expect(decompressed).toEqual(originalBuf);
  });

  it("should skip already-compressed assets", async () => {
    const compiler = getCompiler(
      "./simple.js",
      {},
      {
        output: { path: "/build", filename: "[name].js" },
      },
    );

    new CompressionRspackPlugin({ algorithm: "gzip" }).apply(compiler);
    new CompressionRspackPlugin({ algorithm: "gzip" }).apply(compiler);

    const stats = await compile(compiler);
    const assets = getAssetsNameAndSize(stats, compiler);
    const gzFiles = assets.filter(([name]) => name.endsWith(".gz"));

    expect(gzFiles.length).toBe(1);
  });

  it("should not compress child compilation assets", async () => {
    const compiler = getCompiler(
      "./entry.js",
      {},
      {
        output: {
          path: path.resolve(__dirname, "./outputs"),
          filename: "[name].js",
          chunkFilename: "[id].js",
        },
      },
    );

    new CompressionRspackPlugin({ minRatio: 1 }).apply(compiler);
    new ChildCompilationPlugin().apply(compiler);

    const stats = await compile(compiler);
    const assets = getAssetsNameAndSize(stats, compiler);

    // child-asset.js should NOT have a .gz version — thisCompilation
    // ensures we only compress the parent compilation's assets
    const childGz = assets.filter(([name]) => name.includes("child-asset") && name.endsWith(".gz"));
    expect(childGz).toHaveLength(0);

    // parent assets should still be compressed
    const parentGz = assets.filter(([name]) => name.endsWith(".gz"));
    expect(parentGz.length).toBeGreaterThan(0);

    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("should use compilation cache on rebuild", async () => {
    const compiler = getCompiler(
      "./entry.js",
      {},
      {
        cache: true,
        output: {
          path: path.resolve(__dirname, "./outputs"),
          filename: "[name].js",
          chunkFilename: "[id].js",
        },
      },
    );

    new CompressionRspackPlugin({ minRatio: 1 }).apply(compiler);

    // First build — populates cache
    const stats = await compile(compiler);
    const assets1 = getAssetsNameAndSize(stats, compiler);
    const gz1 = assets1.filter(([name]) => name.endsWith(".gz"));
    expect(gz1.length).toBeGreaterThan(0);

    // Second build — should use cache (same assets)
    const stats2 = await compile(compiler);
    const assets2 = getAssetsNameAndSize(stats2, compiler);
    const gz2 = assets2.filter(([name]) => name.endsWith(".gz"));

    // Same number of compressed files
    expect(gz2.length).toBe(gz1.length);

    expect(getWarnings(stats2)).toMatchSnapshot("warnings");
    expect(getErrors(stats2)).toMatchSnapshot("errors");
  });
});
