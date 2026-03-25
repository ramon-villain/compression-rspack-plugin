import path from "node:path";
import { fileURLToPath } from "node:url";

import { CompressionRspackPlugin } from "../dist/index.js";

import compile from "./helpers/compile.mjs";
import getAssetsNameAndSize from "./helpers/getAssetsNameAndSize.mjs";
import getCompiler from "./helpers/getCompiler.mjs";
import getErrors from "./helpers/getErrors.mjs";
import getWarnings from "./helpers/getWarnings.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('"include" option', () => {
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

  it("matches snapshot for a single `include` value ({RegExp})", async () => {
    new CompressionRspackPlugin({
      include: /\.js(\?.*)?$/i,
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });

  it("matches snapshot for multiple `include` values ({Array<RegExp>})", async () => {
    new CompressionRspackPlugin({
      include: [/\.js(\?.*)?$/i, /\.svg(\?.*)?$/i],
      minRatio: 1,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getAssetsNameAndSize(stats, compiler)).toMatchSnapshot("assets");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
    expect(getErrors(stats)).toMatchSnapshot("errors");
  });
});
