import path from "node:path";
import { fileURLToPath } from "node:url";

import { CompressionRspackPlugin } from "../lib/index.ts";

import compile from "./helpers/compile.ts";
import getAssetsNameAndSize from "./helpers/getAssetsNameAndSize.ts";
import getCompiler from "./helpers/getCompiler.ts";
import getErrors from "./helpers/getErrors.ts";
import getWarnings from "./helpers/getWarnings.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('"filename" option', () => {
  let compiler: ReturnType<typeof getCompiler>;

  it("should work", async () => {
    compiler = getCompiler(
      "./entry.js",
      {},
      {
        output: {
          path: path.resolve(__dirname, "./outputs"),
          filename: "assets/scripts/[name].js?var=[contenthash]#hash",
          chunkFilename: "assets/scripts/[id].[name].js?ver=[contenthash]#hash",
        },
      },
    );

    new CompressionRspackPlugin({
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("matches snapshot for `[path][base].super-compressed.gz[query][fragment]` value ({String})", async () => {
    compiler = getCompiler(
      "./entry.js",
      {},
      {
        output: {
          path: path.resolve(__dirname, "./outputs"),
          filename: "assets/js/[name].js?var=[contenthash]#hash",
          chunkFilename: "assets/js/[id].[name].js?ver=[contenthash]#hash",
        },
      },
    );

    new CompressionRspackPlugin({
      minRatio: 1,
      filename: "[path][base].super-compressed.gz[query][fragment]",
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("matches snapshot for `[name][ext].super-compressed.gz[query]` value ({String})", async () => {
    compiler = getCompiler(
      "./entry.js",
      {},
      {
        output: {
          path: path.resolve(__dirname, "./outputs"),
          filename: "[name].js?var=[contenthash]",
          chunkFilename: "[id].[name].js?ver=[contenthash]",
        },
      },
    );

    new CompressionRspackPlugin({
      minRatio: 1,
      filename: "[name].super-compressed[ext].gz[query]",
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("matches snapshot for custom function ({Function})", async () => {
    compiler = getCompiler(
      "./entry.js",
      {},
      {
        output: {
          path: path.resolve(__dirname, "./outputs"),
          filename: "[name].js?var=[contenthash]#hash",
          chunkFilename: "[id].[name].js?ver=[contenthash]#hash",
        },
      },
    );

    new CompressionRspackPlugin({
      minRatio: 1,
      filename(info) {
        const [, , query] = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(info.filename);

        return `[name][ext].gz${query || ""}`;
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("matches snapshot for custom function ({Function}) and custom algorithm ({Function})", async () => {
    compiler = getCompiler(
      "./entry.js",
      {},
      {
        output: {
          path: path.resolve(__dirname, "./outputs"),
          filename: "[name].js?var=[contenthash]#hash",
          chunkFilename: "[id].[name].js?ver=[contenthash]#hash",
        },
      },
    );

    new CompressionRspackPlugin({
      minRatio: 1,
      filename(info) {
        const [, , query] = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(info.filename);

        return `[name][ext].gz${query || ""}`;
      },
      algorithm(input, _compressionOptions, callback) {
        callback(null, input);
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });
});
