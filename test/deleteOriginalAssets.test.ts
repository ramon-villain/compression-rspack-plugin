import { CompressionRspackPlugin } from "../lib/index.ts";

import compile from "./helpers/compile.ts";
import getAssetsNameAndSize from "./helpers/getAssetsNameAndSize.ts";
import getCompiler from "./helpers/getCompiler.ts";
import getErrors from "./helpers/getErrors.ts";
import getWarnings from "./helpers/getWarnings.ts";

describe('"deleteOriginalAssets" option', () => {
  let compiler;

  beforeEach(() => {
    compiler = getCompiler("./entry.js");
  });

  it("should work and keep original assets by default", async () => {
    compiler = getCompiler("./entry.js");

    new CompressionRspackPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("should work and keep original assets", async () => {
    new CompressionRspackPlugin({
      minRatio: 1,
      deleteOriginalAssets: false,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("should work and delete original assets", async () => {
    new CompressionRspackPlugin({
      minRatio: 1,
      deleteOriginalAssets: true,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("should work and delete original assets when function used", async () => {
    new CompressionRspackPlugin({
      minRatio: 1,
      deleteOriginalAssets: (name) => {
        if (/\.js$/.test(name)) {
          return true;
        }

        return false;
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("should work and report errors on duplicate assets", async () => {
    compiler = getCompiler("./entry.js");

    new CompressionRspackPlugin({
      filename: "[path][base]",
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("should work and do not report errors on duplicate assets when original assets were removed", async () => {
    compiler = getCompiler("./entry.js");

    new CompressionRspackPlugin({
      filename: "[path][base]",
      deleteOriginalAssets: true,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it('should delete original assets and keep source maps with option "keep-source-map"', async () => {
    compiler = getCompiler(
      "./entry.js",
      {},
      {
        devtool: "source-map",
      },
    );

    new CompressionRspackPlugin({
      filename: "[path][base]",
      exclude: /\.map$/,
      deleteOriginalAssets: "keep-source-map",
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });
});
