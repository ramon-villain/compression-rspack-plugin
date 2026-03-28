import zlib from "node:zlib";

import { CompressionRspackPlugin } from "../lib/index.ts";

import compile from "./helpers/compile.ts";
import getAssetsNameAndSize from "./helpers/getAssetsNameAndSize.ts";
import getCompiler from "./helpers/getCompiler.ts";
import getErrors from "./helpers/getErrors.ts";

describe("edge cases", () => {
  it("should not compress assets smaller than threshold", async () => {
    // Use a very large threshold that no asset can reach
    const compiler = getCompiler(
      "./simple.js",
      {},
      {
        output: { path: "/build", filename: "[name].js" },
      },
    );

    new CompressionRspackPlugin({
      threshold: 999999,
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);
    const assets = getAssetsNameAndSize(stats, compiler);
    const gzFiles = assets.filter(([name]) => name.endsWith(".gz"));

    expect(gzFiles).toHaveLength(0);
  });

  it("should throw for unknown algorithm string", () => {
    const compiler = getCompiler(
      "./simple.js",
      {},
      {
        output: { path: "/build", filename: "[name].js" },
      },
    );

    expect(() => {
      new CompressionRspackPlugin({
        algorithm: "unknownAlgorithm",
        minRatio: 1,
      }).apply(compiler);
    }).toThrow('Algorithm "unknownAlgorithm" is not found in "zlib"');
  });

  it("should handle zstdCompress algorithm via zlib", async () => {
    // zstdCompress is available in Node.js 22+ via zlib
    if (!zlib.zstdCompress) {
      return;
    }

    const compiler = getCompiler("./entry.js");

    new CompressionRspackPlugin({
      algorithm: "zstdCompress",
      filename: "[path][base].zst",
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);
    const assets = getAssetsNameAndSize(stats, compiler);
    const zstFiles = assets.filter(([name]) => name.endsWith(".zst"));

    expect(zstFiles.length).toBeGreaterThan(0);
    expect(getErrors(stats)).toHaveLength(0);
  });
});
