import zlib from "node:zlib";
import { compressNativeBinding } from "../lib/compressors/native.ts";
import {
  getBuffer,
  hasImmutablePlaceholder,
  resolveRelatedName,
  shouldDeleteOriginal,
} from "../lib/helpers.ts";
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

  it("getBuffer falls back to source() when buffer() is not available", () => {
    const fakeAsset = {
      name: "test.js",
      source: {
        source: () => "console.log('hello')",
        size: () => 20,
      },
      info: {},
    };
    // biome-ignore lint/suspicious/noExplicitAny: testing with a minimal mock
    const result = getBuffer(fakeAsset as any);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe("console.log('hello')");
  });

  it("resolveRelatedName handles function algorithm + function filename", () => {
    const name = resolveRelatedName(
      (_input: Buffer, _opts: Record<string, unknown>, cb: (err: null, result: Buffer) => void) =>
        cb(null, Buffer.from("")),
      (_pathData: { filename: string }) => "custom.gz",
    );
    expect(name).toMatch(/^compression-function-[a-f0-9]+$/);
  });

  it("shouldDeleteOriginal with function policy", () => {
    expect(shouldDeleteOriginal((name: string) => name.endsWith(".js"), "main.js")).toBe(true);
    expect(shouldDeleteOriginal((name: string) => name.endsWith(".js"), "main.css")).toBe(false);
  });

  it("hasImmutablePlaceholder returns false for function templates", () => {
    expect(hasImmutablePlaceholder(() => "test")).toBe(false);
  });

  it("compressNativeBinding throws for non-string algorithm", () => {
    expect(() => {
      // biome-ignore lint/suspicious/noExplicitAny: testing invalid input
      compressNativeBinding((() => {}) as any, {});
    }).toThrow("Algorithm is not a string");
  });

  it("compressNativeBinding handles brotli without quality param", () => {
    const compress = compressNativeBinding("brotliCompress", { params: {} });
    expect(typeof compress).toBe("function");
  });

  it("compressNativeBinding handles brotli with non-object params", () => {
    const compress = compressNativeBinding("brotliCompress", { params: "invalid" });
    expect(typeof compress).toBe("function");
  });
});
