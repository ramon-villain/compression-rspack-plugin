import path from "node:path";
import { fileURLToPath } from "node:url";

import { CompressionRspackPlugin } from "../dist/index.js";

import compile from "./helpers/compile.mjs";
import getAssetsNameAndSize from "./helpers/getAssetsNameAndSize.mjs";
import getCompiler from "./helpers/getCompiler.mjs";
import getErrors from "./helpers/getErrors.mjs";
import getWarnings from "./helpers/getWarnings.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('"test" option', () => {
  let compiler;

  beforeEach(() => {
    compiler = getCompiler(
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
  });

  it("matches snapshot with empty `test` value", async () => {
    new CompressionRspackPlugin({
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("matches snapshot for a single `test` value ({RegExp})", async () => {
    new CompressionRspackPlugin({
      test: /\.(png|jpg|gif)$/i,
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("matches snapshot for multiple `test` values ({Array<RegExp>})", async () => {
    new CompressionRspackPlugin({
      test: [/\.(png|jpg|gif)$/i, /\.svg/i],
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("should work when no asset to compress", async () => {
    new CompressionRspackPlugin({
      test: /\.(unknown)$/i,
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });
});
