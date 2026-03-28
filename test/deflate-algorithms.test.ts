import zlib from "node:zlib";

import { CompressionRspackPlugin } from "../lib/index.ts";

import compile from "./helpers/compile.ts";
import getAssetsNameAndSize from "./helpers/getAssetsNameAndSize.ts";
import getCompiler from "./helpers/getCompiler.ts";
import getErrors from "./helpers/getErrors.ts";
import getWarnings from "./helpers/getWarnings.ts";

describe('"deflate" and "deflateRaw" algorithms', () => {
  it('should work with "deflate" algorithm (native Rust)', async () => {
    const compiler = getCompiler("./entry.js");

    new CompressionRspackPlugin({
      algorithm: "deflate",
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it('should work with "deflateRaw" algorithm (native Rust)', async () => {
    const compiler = getCompiler("./entry.js");

    new CompressionRspackPlugin({
      algorithm: "deflateRaw",
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("should produce valid deflate output that can be decompressed", async () => {
    const compiler = getCompiler(
      "./simple.js",
      {},
      {
        output: { path: "/build", filename: "[name].js" },
      },
    );

    new CompressionRspackPlugin({
      algorithm: "deflate",
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);

    const originalAsset = stats.compilation.assets["main.js"];
    const compressedAsset = stats.compilation.assets["main.js.gz"];

    expect(compressedAsset).toBeTruthy();

    const originalBuf = Buffer.from(originalAsset.source());
    const compressedBuf =
      typeof compressedAsset.source() === "string"
        ? Buffer.from(compressedAsset.source())
        : compressedAsset.source();

    const decompressed = zlib.inflateSync(compressedBuf);
    expect(decompressed).toEqual(originalBuf);
  });

  it("should produce valid deflateRaw output that can be decompressed", async () => {
    const compiler = getCompiler(
      "./simple.js",
      {},
      {
        output: { path: "/build", filename: "[name].js" },
      },
    );

    new CompressionRspackPlugin({
      algorithm: "deflateRaw",
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);

    const originalAsset = stats.compilation.assets["main.js"];
    const compressedAsset = stats.compilation.assets["main.js.gz"];

    expect(compressedAsset).toBeTruthy();

    const originalBuf = Buffer.from(originalAsset.source());
    const compressedBuf =
      typeof compressedAsset.source() === "string"
        ? Buffer.from(compressedAsset.source())
        : compressedAsset.source();

    const decompressed = zlib.inflateRawSync(compressedBuf);
    expect(decompressed).toEqual(originalBuf);
  });
});
